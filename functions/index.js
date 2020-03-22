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
    });
});