document.getElementById('contact').addEventListener('click', function() {
    const email = 'migueldeharoce@gmail.com';

    const tempInput = document.createElement('textarea');
    tempInput.value = email;
    document.body.appendChild(tempInput);

    tempInput.select();
    document.execCommand('copy');

    document.body.removeChild(tempInput);

    this.innerHTML = 'Email copied to clipboard';

    const contactElement = this;

    setTimeout(function() {
        contactElement.innerHTML = 'Contact me';
    }, 3000);
});