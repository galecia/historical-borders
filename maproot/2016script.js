'use strict';

var utils = new Utils();
var homeLink = $('#home');
var title = $('#page-title');
var stateLink = $('#state-detail-link');
var stateLinkName = $('#breadcrumb-state-name');
var dateList = $('#date-list');
var dateSelect = $('#date-select');
var datePager = $('#date-pager');
var dateLookup = $('#date-lookup');
var hash = utils.getHash(); // this may have to be changed for production

// Jim: update this URL/attribution string if you need
var baseMapUrl = 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
var baseMapAttribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>';

var basemap = new L.tileLayer(baseMapUrl, {
  attribution: baseMapAttribution
});
var mapOpts = {
  center: [39, -97],
  scrollWheelZoom: false,
  zoom: 4
};
var map = new L.Map('map', mapOpts);
var router = new Router({
	'/': mapsMainPage,
	'/:state': loadStateMap
});
var activeLayer = [];
var layerChangeZooming = false;
var userFocused = false;

map.addLayer(basemap);

map.on('dragstart zoomstart', function(event) {
	if (event.type === 'dragstart' || (event.type === 'zoomstart' && !layerChangeZooming)) {
		userFocused = true;
	}
});

initializeForm();
initializeInfo();
startRouter();

// Set up initial form values and event handlers for form changes
function initializeForm() {
	initializeDateList();

	dateSelect.val(utils.getTodaysDate());

	datePager.on('change click', '*', pageDate);

	dateSelect.on('keydown', function (event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			updateDate(event.target.value);
		}
	});

	dateLookup.on('click', function (event) {
	  event.preventDefault();

	  updateDate(dateSelect.val());
	});
}

function initializeDateList() {
  var initialDateOption = $('<option value="initial">-- View Border Changes --</option>');
  dateList.empty();
  dateList.append(initialDateOption);
}

function initializeInfo() {
  var info = $('#info');
  info.children('.name').text('');
  info.children('.dates').text('');
  info.children('.change').text('No region selected.');
}

// initialize the router
function startRouter() {
	// make sure the url has a hash so the router doesn't break
	// change this for production
	if (hash === '' || hash === '/') {
		// window.location = '/maproot/map.html#'; // ideally, remove this bloody index.html nonsense
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
	stateLink.addClass('hidden');

	title.text('Maps');

	initializeInfo();

	initializeDateList();
	datePager.attr('disabled', true);
	datePager.attr('disabled', 'disabled');

	if (activeLayer.length) {
		activeLayer = activeLayer.reduce(function(empty, layer) {
			map.removeLayer(layer);

			return empty;
		}, []);
	}

	cartodb.createLayer(map, 'https://newberrydis.carto.com/api/v2/viz/6b8d5f72-4d05-11e6-8f00-0ee66e2c9693/viz.json')
		.addTo(map)
		.on('done', function(layer) {
			activeLayer.push(layer);
			map.setView(mapOpts.center, mapOpts.zoom);
		});
}

function loadStateMap(state) {
	var stateName = statesList[state];
	var dateListQuery = 'SELECT DISTINCT ON (start_date) start_date, to_char(start_date, \'MM-DD-YYYY\') date FROM us_histcounties_gen001 WHERE state_terr ILIKE \'\%' + stateName + '\%\' ORDER BY start_date ASC';
	var getDateList = $.getJSON(encodeURI('https://newberrydis.cartodb.com/api/v2/sql/?q=' + dateListQuery));

	homeLink.removeClass('hidden');
	stateLink.removeClass('hidden');

	title.text(stateName);
	stateLinkName.text(stateName);

	stateLink.attr('href', '../../pages/' + stateName.replace(' ', '_') + '.html');

	dateSelect.removeAttr('disabled');
	datePager.removeAttr('disabled');

	initializeInfo();

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

function updateDate(date) {
	var state = utils.getHash();

	getLayersForDate(date, state);
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
	initializeDateList();
	$.each(data.rows, function(key, val) {
		var dateOption = $('<option value="' + val.date + '">' + val.date + '</option>');
		var formattedDate, year;

		dateList.append(dateOption);

		if (key === 1) {
			year = val.date.split('-').pop();
			dateSelect.val(year + '-01-01');
		}
	});
}

function setInitialLayer(state) {
	return function(data) {
		var date = data.rows.shift().start_date;

		getLayersForDate(date, state, true);
	}
}

function getLayersForDate(date, state, initialLayer) {
	var stateName = statesList[state];
	var layerQuery = 'SELECT ST_AsGeoJSON(the_geom) as geo, full_name, change, start_date, end_date FROM us_histcounties_gen001 WHERE state_terr ILIKE \'\%' + stateName + '\%\' AND start_date <= \'' + date + '\' AND end_date >= \'' + date + '\'';
	var resizeLayer = initialLayer || !userFocused;

	layerChangeZooming = true;

	return $.getJSON(encodeURI('https://newberrydis.cartodb.com/api/v2/sql/?q=' + layerQuery)).done(function(data) {
		var feature = getFeatureFromData(data),
			layerToDisplay = L.geoJson(feature, {
				onEachFeature: function(feature, layer) {
					layer.on('mouseout', utils.debounce(function(event) {
						event.target.setStyle({
							fillColor: '#0033ff'
						});
					}, 50));
					layer.on('mouseover', utils.debounce(function(event) {
						event.target.setStyle({
							fillColor: '#0099ff'
						});
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

		if (resizeLayer) {
			map.fitBounds(layerToDisplay);
		}

		layerToDisplay.resetStyle();

		layerChangeZooming = false;
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
	var info = $('#info');
	if (info.children('.name').text() !== data.fullName) {
		var startDate = new Date(data.dates.start),
			start = startDate.toDateString(),
			endDate = new Date(data.dates.end),
			end = endDate.toDateString();

		info.addClass('active');
		setTimeout(function() {
			info.removeClass('active');
		}, 200);

		info.children('.name').text(data.fullName);
		info.children('.dates').text(start + ' - ' + end);
		info.children('.change').text(data.change);
	}
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
			var todaysDate = today.getFullYear()+'-'+month+'-'+date;

			return todaysDate;
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
