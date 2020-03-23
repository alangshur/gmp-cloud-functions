const functions = require('firebase-functions');
const admin = require('firebase-admin');
var cors = require('cors')({ origin: true });

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const SURVEY_QUESTIONS = 4;



/*** USER FUNCTIONS ***/

// (AUTH) add user to firestore upon creation
exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        id: user.uid,
        name: user.displayName,
        email: user.email,

        surveyAnswers: null,
        lastSignup: null,
        currentMatch: null
    });
});



/*** SURVEY FUNCTIONS ***/

// (HTTP) update user's survey answers
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
        const surveyAnswers = request.get('Survey');
        if (!surveyAnswers) throw new Error('surv-r');

        // validate survey answers
        for (var i = 0; i < SURVEY_QUESTIONS; i++) {
            if ((surveyAnswers[i] < 0) || (surveyAnswers[i] > 10))
                throw new Error('surv-q');
        }

        // update survey answers
        const userRef = db.collection('users').doc(userId);
        await userRef.update({ surveyAnswers: surveyAnswers });

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