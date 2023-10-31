import { MessageSender } from 'types/global';

function responder(
  message: any,
  sender: MessageSender,
  sendResponse: (response: any) => void,
) {
  console.log('message', message);
  console.log('sender', sender);
  sendResponse('acknowledged');
}

window.addEventListener('load', () => {
  window.chrome.runtime.onMessage.addListener(responder);
});
