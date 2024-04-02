// zoning map
const LEGEND_X = 2554;
const LEGEND_Y = 1107;
const LEGEND_INCREMENT = 68;
const LEGEND_LABELS = [
	["as a", "City Park"],
	["as", "Neighborhood Residential"],
	["as", "Multi-Family Housing"],
	["as", "Multi-Family Housing/Residential-Commercial"],
	["as", "Downtown"],
	["as", "Seattle Mixed"],
	["for", "Commercial/Mixed Use"],
	["for", "Manufacturing/Industrial"],
	["as a", "Master Planning Community"],
	["as a", "Major Institution"]
];

const output = document.getElementById("zoneView");

const canvas = document.getElementById("markers");
const context = canvas.getContext("2d");

let sampleMap, mapWidth, mapHeight;
const colors = [];
const loaded = new Promise(resolve => {
	const image = new Image();
	image.addEventListener("load", () => {
		canvas.width = image.width;
		canvas.height = image.height;

		mapWidth = image.width;
		mapHeight = image.height;
		
		const sampleCanvas = document.createElement("canvas");
		const sampleContext = sampleCanvas.getContext("2d", {
			willReadFrequently: true
		});
		sampleMap = (x, y) => {
			sampleCanvas.width = 3;
			sampleCanvas.height = 3;
			sampleContext.drawImage(image, x - 1, y - 1, 3, 3, 0, 0, 3, 3);
			const [r, g, b] = sampleContext.getImageData(1, 1, 1, 1).data;
			return [r, g, b];
		};

		// read legend
		for (let i = 0; i < LEGEND_LABELS.length; i++)
			colors.push(sampleMap(
				LEGEND_X,
				LEGEND_Y + LEGEND_INCREMENT * i
			));

		resolve();
	});
	image.src = "images/finalMap.png";
});

// zone detection
function errorMessage(error) {
	return `A ${error.constructor.name} occurred (${error.message})`;
}

function colorDistance(a, b) {
	return Math.hypot(...a.map((v, i) => v - b[i]));
}

function updateZone(x, y, locationType) {
	// draw circular marker
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "blue";
	context.beginPath();
	context.arc(x, y, 10, 0, Math.PI * 2);
	context.fill();

	context.fillStyle = "black";
	context.font = "50px sans-serif";
	context.fillText("You are here!", x + 15, y);

	const px = Math.floor(x);
	const py = Math.floor(y);
	
	if (px < 0 || py < 0 || px >= mapWidth || py >= mapHeight) {
		output.innerText = `Your ${locationType} location is outside the map`;
	} else {
		const color = sampleMap(px, py);

		let bestDist = Infinity;
		let bestIndex = 0;
		for (let i = 0; i < colors.length; i++) {
			const target = colors[i];
			const dist = colorDistance(color, target);
			if (dist < bestDist) {
				bestDist = dist;
				bestIndex = i;
			}
		}

		if (bestDist >= 62)
			output.innerText = `Your ${locationType} location does not have a specified zone`;
		else {
			const [prefix, zone] = LEGEND_LABELS[bestIndex];
			output.innerText = `Your ${locationType} location is zoned ${prefix} `;
			const zoneElement = document.createElement("span");
			zoneElement.className = "zone";
			zoneElement.innerText = zone;
			zoneElement.style.background = `rgb(${colors[bestIndex].join(", ")})`;
			output.appendChild(zoneElement);
		}
	}
}

{ // hover zone detection
	canvas.addEventListener("mousedown", event => {
		const bounds = canvas.getBoundingClientRect();
		const x = (event.clientX - bounds.x) / bounds.width * mapWidth;
		const y = (event.clientY - bounds.y) / bounds.height * mapHeight;
		output.innerText = "Loading...";
		loaded.then(() => updateZone(x, y, "selected"));
	});
}

{ // geolocation zone detection
	const PX_PER_MILE = 485 / 2;
	const EQUATORIAL_RADIUS = 3963.1906;
	const POLAR_RADIUS = 3949.9028;
	const REF_LONGITUDE = -122.300880;
	const REF_LATITUDE = 47.686690;
	const REF_X = 1706;
	const REF_Y = 949;

	function getCoord(degrees, radius, baseDegrees, base) {
		return ((degrees - baseDegrees) / 180 * Math.PI * radius) * PX_PER_MILE + base;
	}

	const button = document.getElementById("findZone");
	button.addEventListener("click", () => {
		navigator.geolocation.getCurrentPosition(position => {
			const { longitude, latitude } = position.coords;
			output.innerText = "Loading...";
			loaded.then(() => {
				const x = getCoord(longitude, EQUATORIAL_RADIUS, REF_LONGITUDE, REF_X);
				// radius is negative because a decrease in y is an increase in latitude
				const y = getCoord(latitude, -POLAR_RADIUS, REF_LATITUDE, REF_Y);

				updateZone(x, y, "current");
			});
		}, error => {
			output.innerText = errorMessage(error);
		}, {
			enableHighAccuracy: true
		});
	});
}