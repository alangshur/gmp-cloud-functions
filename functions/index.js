const functions = require('firebase-functions');
const admin = require('firebase-admin');
var cors = require('cors')({ origin: true });
const { 
    getNextMatchingDate,
    getCurrentMatchingDate,
    getPreviousMatchingDate,
    validateCountryRegion,
    pickAgeBucket,
    pickPlacementBuckets
} = require('./util');

// initialze app
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// initialize constants
const QUESTION_COUNT = 15;
const QUESTION_MAP = [
    [ 4, 11 ], 
    [ 7, 13 ],
    [ 14, 8, 2 ], 
    [ 10, 5, 0 ], 
    [ 6, 1, 12 ], 
    [ 3, 9 ]
]; 
/* 
 *  NOTE: Map categories are of decreasing severity (users 
 *  with different answers to lower-index categories are 
 *  far less likely to be placed together).
*/



/*** USER FUNCTIONS ***/

// (AUTH) add user to firestore upon creation
exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        id: user.uid,

        name: user.displayName.split(' ')[0],
        email: user.email,
        age: null,
        country: null,
        region: null,
        surveyAnswers: null,

        signups: [],

        currentMatching: null,
        currentMatchId: null
    });
});



/*** SURVEY FUNCTIONS ***/

// (HTTP) update user survey answers
exports.submitSurvey = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // enforce authentication
        var userId = undefined;
        const token = request.get('Authorization');
        if (!token) throw new Error('auth-r');
        await admin.auth().verifyIdToken(token).then(
            decoded => { userId = decoded.user_id; },
            err => { throw new Error('auth-f'); }
        );

        // fetch survey data
        var surveyAnswers = request.get('Survey');
        if (!surveyAnswers) throw new Error('surv-r');
        surveyAnswers = surveyAnswers.split(','); 

        // fetch field data
        var age = request.get('Age');
        if (!age) throw new Error('age-r');
        var country = request.get('Country');
        if (!country) throw new Error('country-r');
        var region = request.get('Region');
        if (!region) throw new Error('region-r');

        // validate field data
        if (isNaN(age) || (Number(age) < 16) || (Number(age) > 109)) 
            throw new Error('age-v');
        if (!validateCountryRegion(country, region))
            throw new Error('loc-v');

        // validate survey answers
        if (surveyAnswers.length !== QUESTION_COUNT) 
            throw new Error('surv-v');
        for (var i = 0; i < QUESTION_COUNT; i++) {
            const val = Number(surveyAnswers[i]);
            if ((val < 0) || (val > 10)) throw new Error('surv-v');
            surveyAnswers[i] = val;
        }

        // create read-write transaction
        const next = getNextMatchingDate();
        const userRef = db.collection('users').doc(userId);
        await db.runTransaction(transaction => {
            return transaction.get(userRef).then(user => {
                if (!user.exists) throw new Error('user-f');
                else {

                    // enforce a single signup
                    const userData = user.data();
                    if (userData.signups.includes(next))
                        throw new Error('signup');

                    // increment matching user count
                    const matchingRef = db.collection('matchings').doc(next);
                    transaction.update(matchingRef, { 
                        signupCount: admin.firestore.FieldValue.increment(1)
                    });
                    
                    // update user survey answers
                    const userRef = db.collection('users').doc(userId);
                    transaction.update(userRef, {
                        age: age,
                        country: country,
                        region: region,
                        surveyAnswers: surveyAnswers,
                        signups: admin.firestore.FieldValue.arrayUnion(next)
                    });

                    // add user to next matching
                    const signupRef = matchingRef.collection('signups').doc(userId);
                    transaction.set(signupRef, {
                        id: userId, 
                        name: userData.name,
                        email: userData.email,
                        age: age,
                        country: country,
                        region: region,

                        ageBucket: pickAgeBucket(Number(age)),
                        placementBuckets: pickPlacementBuckets(QUESTION_MAP, surveyAnswers),
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
        });

        // return https response
        cors(request, response, () => {
            response.status(200).send({ success: true });
        });
    }
    catch (err) {
        console.log('submitSurvey: ' + err);
        var message = '';

        // select error message
        switch (err.message) {
            case 'auth-r': message = 'Failed to authenticate user. Please wait and try again.'; break;
            case 'auth-f': message = 'Failed to authenticate user. Please wait and try again.'; break;
            case 'user-f': message = 'Failed to retrieve user. Please wait and try again.'; break;
            case 'surv-r': message = 'Failed to retrieve survey. Please wait and try again.'; break;
            case 'age-r': message = 'Failed to retrieve age. Please wait and try again.'; break;
            case 'country-r': message = 'Failed to retrieve country. Please wait and try again.'; break;
            case 'region-r': message = 'Failed to retrieve region. Please wait and try again.'; break;
            case 'age-v': message = 'Please enter a valid age in years.'; break;
            case 'loc-v': message = 'Please select a valid country and region.'; break;
            case 'surv-v': message = 'Please answers all questions before submitting.'; break;
            case 'signup': message = 'You may only sign up once for a given matching.'; break;
            default: message = 'Unexpected server error. Please wait and try again.'; break;
        }

        cors(request, response, () => {
            response.status(200).send({
                success: false,
                message: message
            });
        });
    }
});



/*** SURVEY FUNCTIONS ***/

exports.updateActiveMatching = functions.pubsub.schedule('0 0 * * 6')
    .timeZone('Etc/UTC').onRun(context => {
        const matchingsRef = db.collection('matchings');
        const previousRef = matchingsRef.doc(getPreviousMatchingDate());
        const currentRef = matchingsRef.doc(getCurrentMatchingDate());
        var batch = db.batch();

        // set inactive/active
        batch.update(previousRef, { active: false });
        batch.update(currentRef, { active: true });
        batch.commit();
    });