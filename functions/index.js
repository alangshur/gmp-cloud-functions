const functions = require('firebase-functions');
var cors = require('cors')({ origin: true });

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();



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
exports.updateSurvey = functions.https.onRequest((request, response) => {
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
        console.log(surveyAnswers);

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
            case 'auth-r': message = 'Error authenticating user. Please refresh page.'; break;
            case 'auth-f': message = 'Error authenticating user. Please refresh page.'; break;
        }

        cors(request, response, () => {
            response.send({
                success: false,
                message: message
            });
        });
    }
});