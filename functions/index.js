const functions = require('firebase-functions');
const admin = require('firebase-admin');
var cors = require('cors')({ origin: true });
const { 
    getNextMatchingDate,
    getCurrentMatchingDate,
    validateCountryRegion
} = require('./util');

// initialze app
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// initialize constants
const SURVEY_QUESTIONS = 4;



/*** USER FUNCTIONS ***/

// (AUTH) add user to firestore upon creation
exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        id: user.uid,
        email: user.email,

        name: user.displayName,
        age: '',
        country: '',
        region: '',
        surveyAnswers: null,

        currentMatch: null,
        signups: []
    });
});



/*** SURVEY FUNCTIONS ***/

// (HTTP) update user survey answers
exports.updateSurvey = functions.https.onRequest(async (request, response) => {
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
        if (isNaN(age) || (Number(age) < 12) || (Number(age) > 110)) 
            throw new Error('age-v');
        if (!validateCountryRegion(country, region))
            throw new Error('loc-v');

        // validate survey answers
        for (var i = 0; i < SURVEY_QUESTIONS; i++) {
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
                    const userData = user.data();

                    // increment matching user count
                    const matchingRef = db.collection('matchings').doc(next);
                    if (!userData.signups.includes(next)) {
                        transaction.update(matchingRef, { 
                            userCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                    
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
                    const matchingUserRef = matchingRef.collection('signups').doc(userId);
                    transaction.set(matchingUserRef, {
                        id: userId, 
                        name: userData.name,
                        email: userData.email,
                        age: age,
                        country: country,
                        region: region,
                        surveyAnswers: surveyAnswers 
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
        console.log('updateSurvey: ' + err);
        var message = '';

        // select error message
        switch (err.message) {
            case 'auth-r': message = 'Error authenticating user. Please wait and try again.'; break;
            case 'auth-f': message = 'Error authenticating user. Please wait and try again.'; break;
            case 'user-f': message = 'Error retrieving user. Please wait and try again.'; break;
            case 'surv-r': message = 'Error retrieving survey. Please wait and try again.'; break;
            case 'age-r': message = 'Error retrieving age. Please wait and try again.'; break;
            case 'country-r': message = 'Error retrieving country. Please wait and try again.'; break;
            case 'region-r': message = 'Error retrieving region. Please wait and try again.'; break;
            case 'age-v': message = 'Please enter a valid age in years.'; break;
            case 'loc-v': message = 'Please select a valid country and region.'; break;
            case 'surv-v': message = 'Please answers all questions before submitting.'; break;
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