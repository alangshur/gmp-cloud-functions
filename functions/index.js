const functions = require('firebase-functions');
const admin = require('firebase-admin');
var cors = require('cors')({ origin: true });
const { 
    getNextMatchingDate,
    getCurrentMatchingDate
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
        name: user.displayName,
        email: user.email,

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

        // validate survey answers
        for (var i = 0; i < SURVEY_QUESTIONS; i++) {
            const val = Number(surveyAnswers[i]);
            if ((val < 0) || (val > 10)) throw new Error('surv-q');
            surveyAnswers[i] = val;
        }

        // create read-write transaction
        const next = getNextMatchingDate();
        const userRef = db.collection('users').doc(userId);
        await db.runTransaction(transaction => {
            return transaction.get(userRef).then(user => {
                if (!user.exists) throw new Error('user-f');
                else {

                    // increment matching user count
                    const matchingRef = db.collection('matchings').doc(next);
                    if (!user.data().signups.includes(next)) {
                        transaction.update(matchingRef, { 
                            userCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                    
                    // update user survey answers
                    const userRef = db.collection('users').doc(userId);
                    transaction.update(userRef, { 
                        surveyAnswers: surveyAnswers,
                        signups: admin.firestore.FieldValue.arrayUnion(next)
                    });        

                    // add user to next matching
                    const matchingUserRef = matchingRef.collection('signups').doc(userId);
                    transaction.set(matchingUserRef, {
                        id: userId, 
                        surveyAnswers: surveyAnswers 
                    });
                }
            });
        });

        // return https response
        cors(request, response, () => {
            response.send({ success: true });
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
            case 'surv-q': message = 'Please answers all questions before submitting.'; break;
            default: message = 'Unexpected server error. Please wait and try again.'; break;
        }

        cors(request, response, () => {
            response.send({
                success: false,
                message: message
            });
        });
    }
});