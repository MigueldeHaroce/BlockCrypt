const connectBtn = document.getElementById('connectBtn');
let userAccount;
let contract;

connectBtn.addEventListener('click', async function() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            console.log('MetaMask is installed!');

            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

            userAccount = accounts[0];
            localStorage.userAccount = userAccount;

            changeUI(userAccount);
            console.log("Connected account:", userAccount);

            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Initialize the contract
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

            const contractAddress = '0x7ccaf327770d1eE69283bD21b4C52322e6cd86de'; // Your contract address
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            

        } else {
            console.error('MetaMask is not installed. Please install it to use this feature.');
        }
    } catch (error) {
        console.error("Error fetching accounts:", error);
    }
});

function changeUI(account) {
    console.log('Changing UI: ', account);
}

function encryptPassword(password, key) {
    return CryptoJS.AES.encrypt(password, key).toString();
}

// Decrypt function
function decryptPassword(encryptedPassword, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

const newUserButton = document.getElementById('newUser');

const newUserFunction = async () => {

    const id = inputText.value;
    const userConfirmed = confirm('This ID cannot be changed. Are you sure you want to continue?');
    
    if (!userConfirmed) {
        return;
    }

    try {
        
        const encryptedValue = encryptPassword('Start', id); 
        await contract.setKey(id, encryptedValue);
        alert('New ID created successfully!');
    } catch (error) {
        if (error.message.includes("User already has an ID")) {
            alert('User already has an ID. Cannot create a new one.');
        } else {
            alert('Error setting new ID');
        }
        console.error('Error setting new ID:', error);
    }
};  

newUserButton.addEventListener('click', newUserFunction);