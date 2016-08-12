window.onload = function(){
    var gotostate = document.getElementById("gotostate");
    var stateSelect = document.getElementById("state_select");
    var path = window.location.pathname;
    var hash = window.location.hash.slice(2);
    var mapRadio = document.querySelector('input[value="map"]');
    var statesList = Array.prototype.slice.call(stateSelect.getElementsByTagName('option'));
    var stateElement = statesList.filter(function (state) {
	return state.value.search(hash) !== -1;
    });
    var stateIndex = statesList.indexOf(stateElement[0]);

    if (path.search('map.html') !== -1) {
	mapRadio.checked = true;
	stateSelect.selectedIndex = stateIndex === -1 ? 0 : stateIndex;
    }

    gotostate.onclick = function(){
	var form = document.getElementById("statebox");
	var link = makeLink(form);

	if (link) {
	    window.location.href = link;
	}
    };
};
  
function makeLink(form){
    var link_type = Array.prototype.filter.call(form['link_type'], function(type) {
	return type.checked;
    })[0].value;
    var state = form["state_select"].value.split(";");
    var stateAbbr = state[0];
    var stateName = state[1];
    var location = "http://" + window.location.host + "/ahcbp";

    /* conditional statements to build link based on the link_type */
    if (link_type === "page") {
	return location + "/pages/" + stateName + ".html";
    }
    else if (link_type === "map") {
	if (stateAbbr === 'US'){
	    return "http://historical-county.newberry.org/website/USA/viewer.htm";
	}
	else{
	    // return "http://historical-county.newberry.org/website/" + state.split(";")[1] + "/viewer.htm";
	    return "/maproot/map.html#/" + stateAbbr;
	}
    }
    else if (link_type === "metadata"){
	return location + "/documents/" + stateAbbr + "_Metadata1.htm";
    }
    else {
	// if no link type, send user to same page
	return window.location.href;
    }
}
