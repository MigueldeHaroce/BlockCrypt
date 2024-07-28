const body = document.getElementById('body');
const inputText = document.getElementById('inputText');
const inputText1 = document.getElementById('inputText1');


if (window.location.href.includes('index.html')) {
    const submit = document.getElementById('access');
    const submitImg = document.getElementById('submitImg');
    
    inputText.addEventListener('focus', function() {
        body.classList.add('blurred');
        inputText.classList.add('focused');
        submit.classList.add('focused');
        submitImg.classList.add('focused');
    });
    
    inputText.addEventListener('blur', function() {
        body.classList.remove('blurred');
        inputText.classList.remove('focused');
        submit.classList.remove('focused');
        submitImg.classList.add('focused');
    });
    
}

if (window.location.href.includes('retrieve.html')) {
    const submit = document.getElementById('get');
    const submitImg = document.getElementById('getImg');
    
    inputText.addEventListener('focus', function() {
        body.classList.add('blurred');
        inputText.classList.add('focused');
        submit.classList.add('focused');
        submitImg.classList.add('focused');
    });
    
    inputText.addEventListener('blur', function() {
        body.classList.remove('blurred');
        inputText.classList.remove('focused');
        submit.classList.remove('focused');
        submitImg.classList.add('focused');
    });
}

function initializeSavePage() {
    const submit = document.getElementById('submit');
    const submitImg = document.getElementById('submitImg');
    const inputText1 = document.getElementById('inputText1');
    const body = document.body;

    if (submit && submitImg && inputText1 && body) {
        inputText1.addEventListener('focus', function() {
            body.classList.add('blurred');
            inputText1.classList.add('focused');
            submit.classList.add('focused');
            submitImg.classList.add('focused');
        });

        inputText1.addEventListener('blur', function() {
            body.classList.remove('blurred');
            inputText1.classList.remove('focused');
            submit.classList.remove('focused');
            submitImg.classList.remove('focused');
        });
    }
}

function updateWebsiteURL() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var currentTab = tabs[0];
        if (currentTab) {
            var url = currentTab.url;

            url = url.replace(/^https?:\/\//, '');

            var maxLength = 25;
            if (url.length > maxLength) {
                url = url.substring(0, maxLength - 3) + '...';
            }

            document.getElementById('website').textContent = url;
        }
    });
}

function triggerInitialPageLoad() {
    const namespace = document.querySelector('main').getAttribute('data-barba-namespace');
    if (namespace === 'save' || namespace === 'retrieve') {
        updateWebsiteURL();
    }
    if (namespace === 'save') {
        initializeSavePage();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    triggerInitialPageLoad();
});

barba.init({
    transitions: [{
      name: 'opacity-transition',
      leave(data) {
        return gsap.to(data.current.container, {
          opacity: 0
        });
      },
      enter(data) {
        return gsap.from(data.next.container, {
          opacity: 0
        });
      }
    }],
    views: [{
        namespace: 'save',
        afterEnter() {
            updateWebsiteURL();
            initializeSavePage();
        }
    }, {
        namespace: 'retrieve',
        afterEnter() {
            updateWebsiteURL();
        }
    }]
});