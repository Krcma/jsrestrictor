/** \file
 * \brief JS code for fpd report
 *
 *  \author Copyright (C) 2022  Marek Salon
 *
 *  \license SPDX-License-Identifier: GPL-3.0-or-later
 */
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

/**
 * Event listener that listens for a load of FPD report page. If the page is loaded, fetch FPD data from background.
 *
 * \param callback Function that initializes FPD report creation from fetched data.
 */
window.addEventListener('load', () => {
    browser.runtime.sendMessage({
        purpose: "fpd-get-report-data", 
        tabId: new URLSearchParams(window.location.search).get("id")
    }).then((result) => {
        createReport(result);
    });
});

/**
 * The function that populates FPD report page with data from the latest evaluation and hooks up listeners.
 *
 * \param data Information about latest fingerprinting evaluation consisting of all essential FPD objects.
 */
function createReport(data) {
    var {tabObj, groups, latestEvals, fpDb, exceptionWrappers} = data;
	var report = document.getElementById("fpd-report");
    if (!tabObj || !groups || !groups.root || !groups.all || !fpDb || !latestEvals) {
        report.innerHTML = "ERROR: Missing data, cannot create report! Try to reload the page and reopen the report."
        return;
    }

    // parse latestEvals to create more useful representation for FPD report generation
    var processedEvals = {};
    for (let item of latestEvals.evalStats) {
        processedEvals[item.title] = processedEvals[item.title] || {};
        processedEvals[item.title].type = item.type;
        let total = 0;
        if (fpDb[item.title]) {
            for (let stat of Object.values(fpDb[item.title])) {
                total += stat.total;
            }
        }
        processedEvals[item.title].total = total;
    }

    // add page URL and FavIcon to header section of the report
    if (tabObj) {
        let urlObj = new URL(tabObj.url);
        let url = urlObj.hostname + (urlObj.pathname.length > 1 ? urlObj.pathname : "");
        document.getElementById("report-url").innerHTML = url;
        let img = document.getElementById("pageFavicon");
        img.src = tabObj.favIconUrl;
        img.onload = function () {
            // overwrite default behavior from CSS to show icon only when available
            this.style = "";
        };
    }

    var html = "";

    // generate html code for evaluated group
    let generateGroup = (group) => {
        if (processedEvals[group]) {
            if (groups.all[group].description) {
                html += "<div id=\"" + group + "\" class=\"fpd-group access\">";
                html += "<h2>" + group + "</h2>";
                html += "<p>" + groups.all[group].description + "</p>";
            }
            for (let [item, type] of Object.entries(groups.all[group].items)) {
                if (type == "group") {
                    generateGroup(item);
                }
                else {
                    generateResource(item)
                }
            }
            if (groups.all[group].description) {
                html += "</div>";
            }
        }
    }

    // generate html code for evaluated resource (get,set,call)
    let generateResource = (resource) => {
        if (processedEvals[resource]) {
            let accessRaw = processedEvals[resource].total;
            let accessCount = accessRaw >= 1000 ? "1000+" : accessRaw;
            html += `<h4 class="hidden ${accessRaw > 0 ? "access" : "no-access"}"><span class="dot">-</span> ` +
            `${resource} (${exceptionWrappers.includes(resource) ? "n/a" : accessCount})</h4>`;
        }
    }

    // start generating FPD report from the first group (root group)
    generateGroup(groups.root);
    report.innerHTML += html;

    // hide groups with no relevant entries
    let groupElements = document.querySelectorAll(".fpd-group.access");
    for (let i = groupElements.length; i > 0; i--) {
        if (!document.querySelectorAll(`#${groupElements[i-1].id} > .access`).length) {
            groupElements[i-1].classList.replace("access", "no-access");
        }
    }

    // function that enables to show accessed resources of the group
    let toggleResources = (event) => {
        let parent =  event.target.parentElement;
        for (let i = 0; i < parent.children.length; i++) {
            let child = parent.children[i];
            if (child.tagName == "H4") {
                child.classList.toggle("hidden");
            }
        }
    }

    // make group name clickable only if it makes sense - groups with resources
    let makeClickableTitles = () => {
        for (let element of document.querySelectorAll(".fpd-group")) {
            let button;
            let haveChild = false;
            
            for (let i = 0; i < element.children.length; i++) {
                let child = element.children[i];
                if (child.tagName == "H2") {
                    button = child;
                }
                if (child.tagName == "H4" && !child.classList.contains("no-access")) {
                    haveChild = true;
                }
            }
            
            if (button && haveChild) {
                button.classList.add("clickable");
                button.addEventListener("click", toggleResources);
            }
        }
    }
    makeClickableTitles();

    // show resources for every group in FPD report
    let showAll = (event) => {
        for (let element of document.querySelectorAll(".fpd-group > h4")) {      
            if (event.target.innerText == "Show All") {
                element.classList.remove("hidden");
            }
            else {
                element.classList.add("hidden");
            }
        }
        event.target.innerText = event.target.innerText == "Show All" ? "Hide details" : "Show All";
    }

    // show description/help for the report
    let showDescription = () => {
        for (let element of document.querySelectorAll(".description")) {      
            element.classList.toggle("hidden");
        }
    }

    // show all groups/resources even if not accessed
    let showNotAccessed = () => {
        for (let element of document.querySelectorAll(".no-access")) {      
            element.classList.remove("no-access");
        }
        makeClickableTitles();
    }
    
    document.getElementById("showAll").addEventListener("click", showAll);
    document.getElementById("help").addEventListener("click", showDescription);
    document.getElementById("unhideAll").addEventListener("click", showNotAccessed);
}
