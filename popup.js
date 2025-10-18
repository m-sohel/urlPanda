document.addEventListener('DOMContentLoaded', () => {
    const saveLinkForm = document.getElementById('save-link-form');
    const linkTitleInput = document.getElementById('link-title');
    const linksList = document.getElementById('links-list');

    // ---- Function to display links ----
    const displayLinks = () => {
        linksList.innerHTML = ''; // Clear the current list

        chrome.storage.local.get({ links: [] }, (result) => {
            const links = result.links;

            if (links.length === 0) {
                linksList.innerHTML = '<p style="color: #6b7280; text-align: center;">No links saved yet.</p>';
                return;
            }

            links.forEach((link, index) => {
                const linkItem = document.createElement('div');
                linkItem.className = 'link-item';

                const linkContent = document.createElement('div');
                linkContent.className = 'link-content';

                const favicon = document.createElement('img');
                favicon.src = `https://www.google.com/s2/favicons?domain=${link.url}&sz=16`;
                
                const linkElement = document.createElement('a');
                linkElement.href = link.url;
                linkElement.textContent = link.title;
                linkElement.title = link.url;
                linkElement.target = '_blank';

                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-btn';
                deleteButton.textContent = '🗑️';
                deleteButton.title = 'Delete this link';

                deleteButton.addEventListener('click', () => {
                    links.splice(index, 1);
                    chrome.storage.local.set({ links: links }, () => {
                        displayLinks();
                    });
                });
                
                linkContent.appendChild(favicon);
                linkContent.appendChild(linkElement);
                
                linkItem.appendChild(linkContent);
                linkItem.appendChild(deleteButton);
                linksList.appendChild(linkItem);
            });
        });
    };

    // ---- Event listener for saving a new link ----
    saveLinkForm.addEventListener('submit', (event) => {
        event.preventDefault();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            const customTitle = linkTitleInput.value.trim();

            const newLink = {
                url: currentTab.url,
                title: customTitle || currentTab.title || currentTab.url
            };

            chrome.storage.local.get({ links: [] }, (result) => {
                const links = result.links;
                links.unshift(newLink); // Use unshift to add to the top of the list
                chrome.storage.local.set({ links: links }, () => {
                    linkTitleInput.value = '';
                    displayLinks();
                });
            });
        });
    });

    // ---- Initial call to display links when the popup is opened ----
    displayLinks();
});