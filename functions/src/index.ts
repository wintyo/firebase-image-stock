import express from 'express';
import cookie from 'cookie';
import cors from 'cors';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/** content-typeが分からなかったときのデフォルト */
const DEFAULT_CONTENT_TYPE = 'image/png';

/** 拡張子からcontent-typeを算出するオブジェクトマップ */
const EXT_NAME2CONTENT_TYPE_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

/** セッション情報をCookieに保存するキー名 */
const SESSION_COOKIE_KEY = '__session';

admin.initializeApp();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORSを許可する
app.use(
  cors({
    credentials: true,
    origin: true,
  })
);

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
      addCookie(res, SESSION_COOKIE_KEY, sessionCookie);
      res.send('ok');
    })
    .catch(() => {
      res.status(401).send('auth error');
    });
});

apiRouter.get('/profile', async (req, res) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionCookie = cookies[SESSION_COOKIE_KEY] || '';

  try {
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
    const user = await admin.auth().getUser(decodedClaims.uid);
    res.send(user);
  } catch {
    res.status(401).send('auth error');
  }
});

apiRouter.get('/image/:uid/:fileName', async (req, res) => {
  const { uid, fileName } = req.params;
  const bucket = admin.storage().bucket();

  // no-image画像を返す
  const responseNoImage = async (statusCode: number) => {
    const file = bucket.file('images/public/no-image.jpg');
    const data = await file.download();
    res.status(statusCode);
    res.contentType('image/jpeg');
    res.end(data[0], 'binary');
  };

  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionCookie = cookies[SESSION_COOKIE_KEY] || '';

    // 認証チェック
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);

    // 認証しているユーザとアクセスする画像があっていないときはエラー
    if (decodedClaims.uid !== uid) {
      throw new Error('user id is not matched');
    }
  } catch (err) {
    // エラーの場合はno-image画像を返す
    console.error(err);
    await responseNoImage(401);
    return;
  }

  // 画像データの取得
  const imageData = await (async () => {
    try {
      const file = bucket.file(`images/${uid}/${fileName}`);
      const data = await file.download();
      return data[0];
    } catch {
      return null;
    }
  })();

  // 画像データが存在しなかったらno-image画像を返す
  if (imageData == null) {
    console.log(`images/${uid}/${fileName} is not exist.`);
    await responseNoImage(404);
    return;
  }

  // 取得した画像データを返す
  const [, ext] = fileName.split('.');
  res.contentType(EXT_NAME2CONTENT_TYPE_MAP[ext] || DEFAULT_CONTENT_TYPE);
  res.end(imageData, 'binary');
});

app.use('/api', apiRouter);

export const api = functions.https.onRequest(app);
