import express from 'express';
import cookie from 'cookie';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function addCookie(res: any, key: string, value: string) {
  const expiresIn = 60 * 60 * 24;
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(key, value, {
      maxAge: expiresIn,
      httpOnly: true,
    })
  );
}

const apiRouter = express.Router();

apiRouter
  .get('/cookies', (req, res) => {
    res.setHeader('Cache-Control', 'private');
    const cookies = cookie.parse(req.headers.cookie || '');
    res.send(cookies);
  })
  .post('/cookie', (req, res) => {
    res.setHeader('Cache-Control', 'private');
    addCookie(res, req.body.key, req.body.value);
    res.send('save cookies');
  });

apiRouter.post('/auth', async (req, res) => {
  admin
    .auth()
    .verifyIdToken(req.body.idToken)
    .then((decodedIdToken) => {
      // 認証してから5分以上経過しているトークンはエラーにする
      if (Date.now() / 1000 - decodedIdToken.auth_time >= 5 * 60) {
        throw new Error('auth expired');
      }
      return admin.auth().createSessionCookie(req.body.idToken, {
        expiresIn: 24 * 60 * 60 * 1000,
      });
    })
    .then((sessionCookie) => {
      addCookie(res, '__session', sessionCookie);
      res.send('ok');
    })
    .catch(() => {
      res.status(401).send('auth error');
    });
});

apiRouter.get('/profile', async (req, res) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionCookie = cookies.__session || '';

  const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
  const user = await admin.auth().getUser(decodedClaims.uid);
  res.send(user);
});

app.use('/api', apiRouter);

export const api = functions.https.onRequest(app);
