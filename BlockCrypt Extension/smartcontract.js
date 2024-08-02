// ONLY TESTING

const createMetaMaskProvider = require('metamask-extension-provider');

const provider = createMetaMaskProvider();

provider.on('error', (error) => {
  console.error("Failed to connect to MetaMask:", error);
});

if (provider) {
    window.web3 = new Web3(provider);
} else {
    console.error("MetaMask is not installed");
}

let userAccount = null; 

if (window.location.href.includes('index.html')) {

  const connectBtn = document.getElementById('connectBtn');

  let currentIconType = 'blockies'; 

  connectBtn.addEventListener('click', async function() {
      try {
        const accounts = await web3.eth.requestAccounts();
        userAccount = accounts[0];
        localStorage.userAccount = userAccount;
        changeUI(userAccount)
        console.log("Connected account:", userAccount);
      } catch (error) {
          console.error("Error fetching accounts:", error);
      }
  }); 
  function changeUI(adress) {
    const connectBtn = document.getElementById('connectBtn');
    connectBtn.style.display = 'none';

    if (adress.length > 19) {
      const adressM = adress.substring(0, 19 - 3) + '...';
      const usersss = document.getElementById('user');
      usersss.innerHTML = adressM;
    } else  {
      const usersss = document.getElementById('user');
      usersss.innerHTML = adress;
    }
/*
    const icon = blockies.create({ seed: adress.toLowerCase(), size: 8, scale: 16 });
    const iconElement = document.getElementById('img');
    iconElement.src = icon.toDataURL();
    iconElement.alt = 'User Icon';
  */
  }
}
const contractABI = [
    
  
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "key",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "encryptedValue",
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
          "name": "key",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "value",
          "type": "string"
        }
      ],
      "name": "setKey",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "key",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "value",
          "type": "string"
        }
      ],
      "name": "setNewId",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "key",
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
    }
  
];

const contractAddress = '0x0ac2fE0CCe763e7947E60D021c6DC1554c000c4b';

const contract = new web3.eth.Contract(contractABI, contractAddress);

function encryptPassword(password, key) {
    return CryptoJS.AES.encrypt(password, key).toString();
}

// Decrypt function
function decryptPassword(encryptedPassword, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// access passwords
if (window.location.href.includes('index.html')) {
    console.log('aa');

    const accessButton = document.getElementById('access');
    const inputText = document.getElementById('inputText');
    const newUserButton = document.getElementById('newUser');


    const accessFunction = async () => {
        const id = inputText.value;
        localStorage.idUser = id;
        console.log(localStorage.idUser);
        try {
            console.log('a');
            const encryptedPassword = await contract.methods.getValue(id).call({ from: userAccount });
            console.log(encryptPassword);

            const decryptedPassword = decryptPassword(encryptedPassword, id);
            console.log(decryptedPassword);
            setInterval(() => {

            }, 1000);
            if (decryptedPassword === '') {
              
                alert('Password not found');
                return;
            } else {
                window.location.href = 'save.html';
            }
        } catch (error) {
            alert('Error retrieving password');
            console.error('Error retrieving password:', error);
        }
    };



    accessButton.addEventListener('click', accessFunction);

    inputText.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            accessFunction();
        }
    });

    
}

// Save password
if (window.location.href.includes('save.html')) {
  document.getElementById('submit').addEventListener('click', async () => {
      const id = localStorage.idUser;
      const website = document.getElementById('website').innerHTML;
      const newPassword = `${website}: ${document.getElementById('inputText1').value}`;

      try {
          const user = localStorage.userAccount;
          console.log(user);
          const encryptedList = await contract.methods.getValue(id).call({ from: user });

          let decryptedList = decryptPassword(encryptedList, id);
          let passwordsArray = decryptedList ? decryptedList.split(', ') : [];
          const existingIndex = passwordsArray.findIndex(pair => pair.startsWith(website + ':'));
          
          if (existingIndex !== -1) {
              passwordsArray[existingIndex] = newPassword;
          } else {
              passwordsArray.push(newPassword);
          }

          decryptedList = passwordsArray.join(', ');
          const encryptedPasswordList = encryptPassword(decryptedList, id);
          await contract.methods.setKey(id, encryptedPasswordList).send({ from: user });
          alert('Password saved successfully!');
      } catch (error) {
          alert('Error saving password');
          console.error('Error saving password:', error);
      }
  });
}

if (window.location.href.includes('retrieve.html')) {

    console.log('aa');
    
    document.getElementById('get').addEventListener('click', async () => {
        const id = localStorage.idUser;
        const website = document.getElementById('website').innerHTML; 
        try {
            const encryptedList = await contract.methods.getValue(id).call({ from: localStorage.userAccount });
            const decryptedList = decryptPassword(encryptedList, id);

            const passwordsArray = decryptedList.split(', ');
            const websitePasswordPair = passwordsArray.find(pair => pair.startsWith(website + ':'));
            if (websitePasswordPair) {
                const password = websitePasswordPair.split(': ')[1];
                document.getElementById('inputText').value = password;

                console.log(`Password for ${website}: ${password}`);
            } else {
                console.log('Password for the specified website not found');
            }
        } catch (error) {
            alert('Error retrieving password');
            console.error('Error retrieving password:', error);
        }
    });
}