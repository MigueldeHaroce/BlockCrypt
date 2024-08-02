### BlockCrypt Extension

BlockCrypt is a web application designed to securely retrieve and manage passwords using decentralized technologies. By leveraging blockchain and cryptographic libraries, this project ensures that user passwords are encrypted and stored in a highly secure manner, reducing the risk of filtrations that happens on normal servers or localy saved passwords.

### Core functionality 

The core functionality of the BlockCrypt Extension is built using a combination of Solidity and JavaScript. The project includes several key libraries that facilitate cryptographic operations and blockchain interactions:

- **Crypto-JS**: Used for cryptographic operations such as encryption and decryption of passwords.
- **Ethers.js** and **Web3.js**: These libraries enable interaction with the Ethereum blockchain, allowing for decentralized storage and retrieval of encrypted passwords.
- **Metamask-Extension-Provider**: Make possible the interaction with Metamask in a chrome extension.
  
The JavaScript files (`bundle.js` and `appfunctions.js`) handle the logic for interacting with the blockchain, encrypting/decrypting passwords, and managing the user interface.

#### Decentralization and Security
BlockCrypt links an 'ID' to the user's address, which is created on the BlockCrypt website. This ID is used to save or retrieve passwords securely. By utilizing blockchain technology, BlockCrypt Extension ensures that passwords are not stored on a centralized server, which can be a single point of failure. Instead, encrypted passwords are stored on the blockchain, making it extremely difficult for attackers to access them without the correct decryption keys. This decentralized approach enhances security and privacy for users.


![Screenshot 2024-08-01 214125](https://github.com/user-attachments/assets/f327b497-94ea-4fff-aa28-0859143b7237)
![Screenshot 2024-08-01 214241](https://github.com/user-attachments/assets/a948f0b1-3fa6-4c5c-965a-2ebec6d839bc)
