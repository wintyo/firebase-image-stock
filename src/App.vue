<template lang="pug">
div
  template(v-if="state.isAuthorizing")
    p 認証中
  template(v-else)
    template(v-if="state.user == null")
      button(@click="onLoginButtonClick") ログイン
    template(v-else)
      p ログイン済
      button(@click="onGetCookiesButtonClick") get cookies
      div
        div
          label key:
          input(v-model="cookieForm.key")
        div
          label value:
          input(v-model="cookieForm.value")
        button(@click="onPostCookiesButtonClick") post cookies
      p
        div {{ state.user.displayName }}
        div {{ state.user.email }}
      input(type="file", @change="onUploadFile")
      p 画像一覧
      template(v-for="imageInfo in state.imageInfoList")
        div
          img(:src="imageInfo.url")
          div {{ imageInfo.name }}
</template>

<script lang="ts">
import { defineComponent, reactive, onMounted } from 'vue';
import HelloWorld from './components/HelloWorld.vue';

import firebase, { auth, authProviders, storage } from './firebase/';
import axios from 'axios';

interface IState {
  isAuthorizing: boolean;
  user: firebase.User | null;
  imageInfoList: Array<{
    name: string;
    url: string;
  }>;
}

export default defineComponent({
  name: 'App',
  components: {
    HelloWorld,
  },
  setup() {
    const state = reactive<IState>({
      isAuthorizing: true,
      user: null,
      imageInfoList: [],
    });

    const cookieForm = reactive<{ key: string; value: string }>({
      key: '',
      value: '',
    });

    onMounted(() => {
      auth.onAuthStateChanged((user) => {
        console.log(user);
        state.isAuthorizing = false;
        state.user = user;

        if (state.user != null) {
          const storageRef = storage.ref();
          storageRef
            .child(`images/${state.user.uid}`)
            .listAll()
            .then((value) => {
              console.log(value);
              // value.items
              Promise.all(
                value.items.map(async (item) => {
                  const imageUrl: string = await item.getDownloadURL();
                  return {
                    name: item.name,
                    url: imageUrl,
                  };
                })
              ).then((imageInfoList) => {
                console.log(imageInfoList);
                state.imageInfoList = imageInfoList;
              });
            });

          state.user.getIdToken().then(async (idToken) => {
            console.log(idToken);

            const res = await axios.post('/api/auth', {
              idToken,
            });
            console.log(res);
          });
        }
      });
    });

    return {
      state,
      cookieForm,
      onGetCookiesButtonClick: async () => {
        const res = await axios.get('/api/cookies');
        console.log(res);
      },
      onPostCookiesButtonClick: async () => {
        const res = await axios.post('/api/cookie', {
          key: cookieForm.key,
          value: cookieForm.value,
        });
        console.log(res);
      },
      onLoginButtonClick: () => {
        auth.signInWithRedirect(authProviders.Google);
      },
      onUploadFile: (event: Event) => {
        if (state.user == null) {
          return;
        }
        const elInput = event.currentTarget as HTMLInputElement;
        if (elInput.files == null) {
          return;
        }
        const file = elInput.files[0];

        const storageRef = storage.ref();
        const uploadTask = storageRef.child(`images/${state.user.uid}/test.png`).put(file);
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            console.log(snapshot);
          },
          (err) => {
            console.error(err);
          },
          () => {
            uploadTask.snapshot.ref.getDownloadURL().then((downloadUrl) => {
              console.log(downloadUrl);
            });
          }
        );
      },
    };
  },
});
</script>

<style>
#app {
  margin-top: 60px;
  color: #2c3e50;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  text-align: center;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
