// ==UserScript==
// @name         RR Elections Check
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @author       suicaed
// @description
// @updateURL    https://github.com/suicaed/RR_ElectionsCheck/raw/main/script.user.js
// @downloadURL  https://github.com/suicaed/RR_ElectionsCheck/raw/main/script.user.js
// @match        https://rivalregions.com/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const target = document.getElementById('header_slide_inner');
    const observer = new MutationObserver(mutations => {
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                checkForUrl(window.location.href);
            }
        }
    });

    observer.observe(target, { childList: true });

    /*window.addEventListener('hashchange', e => {
        checkForUrl(e.newURL);
    });*/
})();

async function checkForUrl(url) {
    const URL = url.match(/elections\/leader\/(?<leader>\d+)|elections\/parliament\/(?<parliament>\d+)/);
    if(URL) {
        let stateId;

        if (URL.groups.leader) {
            stateId = URL.groups.leader;
        } else if (URL.groups.parliament) {
            stateId = await fetch(`https://rivalregions.com/parliament/index/${URL.groups.parliament}`)
                .then(r => r.text())
                .then(d => d.match(/action="map\/state_details\/(?<stateId>\d+)"/).groups.stateId);
        }

        addButton(stateId);
    }
}

function addButton(stateId) {
    const table = document.getElementById('table_list');
    const wrapper = document.querySelector('.jspPane');

    const inner = document.createElement('div');
    inner.style = 'display: flex; margin: 0px 0px 20px';

    const button = document.createElement('div');
    button.id = 'echeck_button';
    button.classList = 'button_blue';
    button.textContent = 'Check elections';

    inner.appendChild(button);
    wrapper.insertBefore(inner, table)

    button.addEventListener('click', async () => {
        button.style = 'pointer-events: none; color: transparent; background-image: url(https://i.ibb.co/xGV9Vzy/loading.gif); background-size: contain; background-position: center; background-repeat: no-repeat;';
        const votedIds = await getUsersVoted(getSourcesList());
        let residentIds = [];
        for (let i = 0; ; i += 25) {
            let currLength = residentIds.length;
            const tmp = await getUsersId(stateId, 'residency_state', i);
            residentIds = [...residentIds, ...tmp];
            if(residentIds.length - currLength < 25) break;
        }

        const nonVoterIds = residentIds.filter(id => !votedIds.includes(id));
        const result = await Promise.all(nonVoterIds.map(async id => {
            const user = await fetch(`https://rivalregions.com/slide/profile/${id}`)
            .then(r => r.text())
            .then(d => {
                const name = d.match(/Профиль: (?<name>.*)\<\/h1\>/).groups.name;
                const lvl = Number(d.match(/Уровень: (?<lvl>\d+)/).groups.lvl);
                return {name: name, lvl: lvl};
            });
            if (user.lvl >= 50) {
                return `${user.name}---${`https://rivalregions.com/#slide/profile/${id}`}`;
            } else return false;
        }));

        navigator.clipboard.writeText(result.filter(user => !!user).join('\n'));
        button.style = 'pointer-events: none;';
        button.textContent = 'Copied to clipboard';
    });
}

function getSourcesList() {
    const table = document.getElementById('table_list');
    const spans = table.querySelectorAll('span[action]');
    return [...spans]
        .filter(span => span.textContent > 0)
        .map(span => ({ count: span.textContent, link: `https://rivalregions.com/${span.getAttribute('action')}` }));
}

async function getUsersVoted(list) {
    let users = [];
    for(const item of list) {
        const addUsers = await fetch(item.link).then(r => r.text()).then(d => [...d.matchAll(/tr user="(?<id>\d+)"/g)].map(item => item.groups.id));
        users = [...users, ...addUsers];
    }

    return users;
}

async function getUsersId (areaId, areaType, pos) {
    const tmp = areaType === 'residency' || areaType === 'residency_state' ? '0/' : '';
    return await fetch(`https://rivalregions.com/listed/${areaType}/${areaId}/${tmp}${pos}`,{
        method: 'GET',
    })
        .then(r => r.text())
        .then(
        d => {
            const usersId = [...d.matchAll(/tr\[user="(?<id>[0-9]+)"\]/g)].map(item => item.groups.id);
            return usersId;
        })
        .catch(err => {document.getElementById('msender_log_history').textContent += `Error in getUsersId: ${err}`});
}