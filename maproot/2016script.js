'use strict';

var utils = new Utils();
var homeLink = $('#home');
var title = $('#page-title');
var dateList = $('#date-list');
var stateSelect = $('#state-select');
var dateSelect = $('#date-select');
var datePager = $('#date-pager');
var hash = utils.getHash(); // this may have to be changed for production

// Jim: update this URL/attribution string if you need
var baseMapUrl = 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
var baseMapAttribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>';

var basemap = new L.tileLayer(baseMapUrl, {
  attribution: baseMapAttribution
});
var initialMapCoords = {
  center: [39, -97],
  zoom: 4
};
var map = new L.Map('map', initialMapCoords);
var router = new Router({
	'/': mapsMainPage,
	'/:state': loadStateMap
});
var activeLayer = [];

map.addLayer(basemap);

initializeForm();
startRouter();

// Set up initial form values and event handlers for form changes
function initializeForm() {
	var initialDateOption = $('<option value="initial">-- Select a Border Start Date --</option>');
	var initialStateOption = $('<option value="initial">-- Select a State --</option>');
	var initialDate = utils.getTodaysDate();

	dateSelect.val(initialDate);
	stateSelect.append(initialStateOption);
	dateList.append(initialDateOption);

	$.each(statesList, function(abbr, state) {
		var selected = (state === statesList[hash]) ? ' selected' : '';
		var stateOption = $('<option value="'+abbr+'"'+selected+'>'+state+'</option>');

		stateSelect.append(stateOption);
	});

	datePager.on('change click', '*', pageDate);
	dateSelect.on('change', utils.debounce(updateDate, 800));
	stateSelect.on('change', viewState);

	homeLink.on('click', function(event) {
		event.preventDefault();

		router.setRoute('/');
	});
}

// initialize the router
function startRouter() {
	// make sure the url has a hash so the router doesn't break
	// change this for production
	if (hash === '' || hash === '/') {
		window.location = '/historical-borders/maproot/map.html#'; // ideally, remove this bloody index.html nonsense
	}

	router.configure({
		// uncomment html5history if the server supports clean urls
		// change this for production
		// html5history: true,
		notfound: mapsMainPage
	});

	router.init('/');
}

/**
 * Routes
 */

function mapsMainPage() {
	homeLink.addClass('hidden');

	title.text('Maps');
	stateSelect.val('initial');

	dateSelect.attr('disabled', true);
	datePager.attr('disabled', 'disabled');

	if (activeLayer.length) {
		activeLayer = activeLayer.reduce(function(empty, layer) {
			map.removeLayer(layer);

			return empty;
		}, []);
	}

	$.getJSON('https://jimbo.cartodb.com/api/v2/sql/?q=SELECT * FROM us_histcounties_gen001')
		.done(function(data) {
			console.log(data);
		});
	cartodb.createLayer(map, 'https://jimbo.cartodb.com/api/v2/viz/cd22c75c-c0b7-11e5-8529-0e787de82d45/viz.json')
		.addTo(map)
		.on('done', function(layer) {
			activeLayer.push(layer);

			// map.fitBounds(layer);
			map.setView(initialMapCoords.center, initialMapCoords.zoom);

			console.log('main map done');
		});
}

function loadStateMap(state) {
	var dateListQuery = 'SELECT DISTINCT ON (start_date) start_date, to_char(start_date, \'MM-DD-YYYY\') date FROM ' + state.toLowerCase() + '_historical_counties ORDER BY start_date ASC';
	var getDateList = $.getJSON('https://jimbo.cartodb.com/api/v2/sql/?q=' + dateListQuery);

	homeLink.removeClass('hidden');

	title.text(statesList[state]);

	dateSelect.removeAttr('disabled');
	datePager.removeAttr('disabled');

	getDateList
		.done(populateDateList)
		.done(setInitialLayer(state));
}

/**
 * Events
 */

function pageDate(event) {
	event.preventDefault();

	var val = event.target.value.trim();
	var fromList = !!parseInt(val, 10);
	var selectedEl = dateList.find('option[value="' + dateList.val() + '"]');
	var state = utils.getHash();
	var bumperVal;

	if (fromList) {
		getLayersForDate(val, state);
	} else if (val === 'initial') {
		return;
	} else {
		bumperVal = selectedEl[val]().val();

		dateList.val(bumperVal);

		if (bumperVal === 'initial' || typeof bumperVal === 'undefined') {
			return;
		}

		getLayersForDate(bumperVal, state);
	}
}

function updateDate(event) {
	event.preventDefault();

	var date = event.target.value;

	console.log('updating Date field', event.target, date);
}

function viewState(event) {
	event.preventDefault();

	var state = event.target.value;

	router.setRoute(state);
}

/**
 * Data
 */

function populateDateList(data) {
	$.each(data.rows, function(key, val) {
		var dateOption = $('<option value="' + val.date + '">' + val.date + '</option>');

		dateList.append(dateOption);
	});
}

function setInitialLayer(state) {
	return function(data) {
		var date = data.rows.shift().start_date;

		getLayersForDate(date, state);
	}
}

function getLayersForDate(date, state) {
	var layerQuery = 'SELECT ST_AsGeoJSON(the_geom) as geo, full_name, change, start_date, end_date FROM ' + state.toLowerCase() + '_historical_counties WHERE start_date <= \'' + date + '\' AND end_date >= \'' + date + '\'';

	return $.getJSON('https://jimbo.cartodb.com/api/v2/sql/?q=' + layerQuery).done(function(data) {
		var feature = getFeatureFromData(data),
			layerToDisplay = L.geoJson(feature, {
				onEachFeature: function(feature, layer) {
					layer.on('mouseover', utils.debounce(function(event) {
						populateInfo(feature.properties);
					}, 50));
				}
			});

		if (activeLayer.length) {
			activeLayer = activeLayer.reduce(function(empty, layer) {
				map.removeLayer(layer);

				return empty;
			}, []);
		}

		activeLayer.push(layerToDisplay);

		layerToDisplay.addTo(map);

		map.fitBounds(layerToDisplay);

		layerToDisplay.resetStyle();
	});
}

function getFeatureFromData(data) {
	var feature = [],
		i, currentRow, rowFeature;

	for (i = 0; i < data.rows.length; i++) {
		currentRow = data.rows[i];
		rowFeature = JSON.parse(currentRow.geo);

		feature.push({
			type: 'Feature',
			geometry: rowFeature,
			properties: {
				fullName: currentRow.full_name,
				change: currentRow.change,
				dates: {
					start: currentRow.start_date,
					end: currentRow.end_date
				}
			}
		});
	}

	return feature;
}

function populateInfo(data) {
	var info = $('#info'),
		startDate = new Date(data.dates.start),
		start = startDate.toDateString(),
		endDate = new Date(data.dates.end),
		end = endDate.toDateString();

	info.children('.name').text(data.fullName);
	info.children('.dates').text(start + ' - ' + end);
	info.children('.change').text(data.change);
}

/**
 * Utilities
 */

function Utils() {
	return {
		getHash: function() {
			return window.location.hash.replace(/^[#\/]+/, '');
		},
		getTodaysDate: function() {
			var today = new Date();
			var month = initialZero(today.getMonth() + 1);
			var date = initialZero(today.getDate());

			return today.getFullYear()+'-'+month+'-'+date;
		},
		debounce: function(func, wait, immediate) {
			var timeout;
			return function() {
				var context = this, args = arguments;
				var later = function() {
					timeout = null;
					if (!immediate) func.apply(context, args);
				};
				var callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
				if (callNow) func.apply(context, args);
			};
		}
	}

	function initialZero (int) {
		var num = String(int);

		return (num.length > 1) ? num : '0' + num;
	}
}
