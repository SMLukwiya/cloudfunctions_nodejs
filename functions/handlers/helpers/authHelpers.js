const { admin, db } = require('../../config/admin');

// Authentication middleware
module.exports = (req, res, next) => {
  let idToken;
  if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    idToken= req.headers.authorization.split('Bearer ')[1];
  } else {
    console.error('No token found');
    return res.status(403).json({ error: 'Unauthorized'});
  }
  // make sure our app sent the token
  admin.auth().verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken; // the decodedToken contains info of the user
      console.log(decodedToken);
      return db.collection('users')
        .where('userId', '==', req.user.uid) //use the req.user to get your user from database
        .limit(1)
        .get();
    })
    .then(data => {
      req.user.handle = data.docs[0].data().handle;
      req.user.imageUrl = data.docs[0].data().imageUrl
      return next();
    })
    .catch(err => {
      console.error('Error while verifying token ', err);
      return res.status(403).json({message: "Error while verifying token"})
    })
}
