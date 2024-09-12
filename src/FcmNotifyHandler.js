const { initializeApp } = require('firebase-admin/app');
const { credential } = require('firebase-admin');
const { getMessaging } = require ('firebase-admin/messaging');

class FcmNotifyHandler {
  app;

  initialize(config) {
    this.app = initializeApp({
      credential: credential.cert(config)
    });
  }

  /**
   * Sends a message, we dont check if the structure of
   * the message its correct, our only responsability its
   * to send a firebase cloud message
   *
   * @param {JSON} message the payload from database
   * @returns {Promise<void>} .
   */
  async sendMessage(message) {
    let response;
    try {
      response = await getMessaging(this.app).send(message);
      console.log('Successfully sent message:', response);
    } catch (err) {
      //const error = err.toJSON();
      //throw new Error(`${error.code}-${error.message}`);
      console.log(err.message)
    }
  }
}

module.exports = new FcmNotifyHandler();