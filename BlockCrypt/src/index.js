const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Web3 = require('web3').default; // Import web3.js library

// Initialize Web3 with the Sepolia testnet provider URL
//const providerUrl = 'https://sepolia.infura.io/v3/b9750da435b048b885b77e0b1d42724b';

// Replace 'YOUR_PROJECT_ID' with your Infura project ID
const provider = new Web3.providers.HttpProvider('https://sepolia.infura.io/v3/b9750da435b048b885b77e0b1d42724b');
const web3 = new Web3(provider);

web3.eth.accounts.wallet.add("0xb062fa28696d5b56fe0ad7d5b7ef616c9c1c5dcd3352cd4958fdcd5ab1ac17ed");

// Your contract ABI and address
const contractABI = [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "string",
          "name": "id",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "pass",
          "type": "string"
        }
      ],
      "name": "KeyValuePairSet",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "id",
          "type": "string"
        }
      ],
      "name": "getValue",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "id",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "pass",
          "type": "string"
        }
      ],
      "name": "setKey",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
];

const contractAddress = '0x15E77C7DAe92952f627739f0473D17F29019EB28'; // Your contract address

// Get the contract instance
const contract = new web3.eth.Contract(contractABI, contractAddress);

// CreateWindow function, event handlers, etc.

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle IPC messages from renderer process
// index.js

ipcMain.on('save-password', async (event, data) => {
  console.log('Received ID:', data.id);
  console.log('Received password:', data.password);
  try {
    // Call the setKey function of your contract to save the password
    await contract.methods.setKey(data.id, data.password).send({ from: '0xfd12Db8cC3C69edc632d7e11E2f0eEA60dFd995c' }); // Update with your wallet address
    event.reply('password-saved', 'Password saved successfully!');
    console.log('Password saved successfully!');
  } catch (error) {
    event.reply('password-save-error', 'Error saving password');
    console.error('Error saving password:', error);
  }
});


ipcMain.on('retrieve-passwords', async (event, id) => {
  try {
    // Call the getValue function of your contract to retrieve passwords
    console.log('Retrieving passwords for ID:', id);
    const passwords = await contract.methods.getValue(id).call();
    console.log('Passwords retrieved:', passwords);
    event.reply('passwords-retrieved', passwords);
  } catch (error) {
    event.reply('password-retrieve-error', 'Error retrieving passwords');
  }
});
