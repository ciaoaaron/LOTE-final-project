


const serviceUuid = "81c30e5c-0000-4f7d-a886-de3e90749161";
const intUUID = "81c30e5c-300b-4f7d-a886-de3e90749161";  // receive is from the phone's perspective

let ble, charCharacteristic, latestData;
let matchStarted = false;


const connectButton = document.querySelector('.ble-btn');

function setup() {
    console.log('[p5] setting up');
    ble = new p5ble();
    connectButton.addEventListener('click', this.connectBLE);
    
}

function draw() {
  if (matchStarted) connectButton.classList.add('hidden');
}

function connectBLE(e) {  
  connectAndStartNotify();
}

function connectAndStartNotify() {
    // Connect to a device by passing the service UUID
    ble.connect(serviceUuid, gotCharacteristics);
  }
  
  // handler for when BLE characteristics are available. 
  function gotCharacteristics(error, characteristics) {
    // if (!characteristics) return;
    if (error) console.log('[gotCharacteristics] error: ', error);
    console.log(`[gotCharacteristics] characteristics:`);
    console.log(characteristics);
  
    charCharacteristic = characteristics?.filter(char => intUUID === char.uuid)[0];
  
    if (charCharacteristic) {
      console.log('[gotCharacteristics] charCharacteristic: ');
      console.log(charCharacteristic);
      // ble.startNotifications(charCharacteristic, handleNotifications);
      matchStarted = true;
    }
  }
  