if (typeof window.ethereum !== 'undefined') {
    window.web3 = new Web3(window.ethereum);
    try {
        await window.ethereum.enable();
    } catch (error) {
        console.error("User denied account access");
    }
} else {
    console.error("MetaMask is not installed");
}

async function getCurrentAccount() {
    const accounts = await web3.eth.requestAccounts();
    return accounts[0];
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
        }
];

const contractAddress = '0xa509965CAD53bDeEc4E4304C73d629F41253e9E5'; // Your contract address

const contract = new web3.eth.Contract(contractABI, contractAddress);

function encryptPassword(password, key) {
    return CryptoJS.AES.encrypt(password, key).toString();
}

// Decrypt function
function decryptPassword(encryptedPassword, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// Save password
document.getElementById('saves-btn').addEventListener('click', async () => {
    const id = document.getElementById('user-id').value;
    const password = document.getElementById('password').value;
    const encryptedPassword = encryptPassword(password, id);
    try {
        const userAccount = await getCurrentAccount();
        await contract.methods.setKey(id, encryptedPassword).send({ from: userAccount });
        alert('Password saved successfully!');
    } catch (error) {
        alert('Error saving password');
        console.error('Error saving password:', error);
    }
});

// Retrieve passwords
document.getElementById('view-passwords-btn').addEventListener('click', async () => {
    const id = document.getElementById('user-id').value;
    try {
        const userAccount = await getCurrentAccount();
        const encryptedPassword = await contract.methods.getValue(id).call({ from: userAccount });
        const decryptedPassword = decryptPassword(encryptedPassword, id);
        alert(`Password: ${decryptedPassword}`);
    } catch (error) {
        alert('Error retrieving password');
        console.error('Error retrieving password:', error);
    }
});