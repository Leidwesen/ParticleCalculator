function $S(selector) { return document.querySelector(selector); }
function $Sall(selector) { return document.querySelectorAll(selector); }

// TODO
// 'show all routes' option
// finite quantity of a given step?

const PRESETS = {
    // "Name" : [steps, daily limit, [forcing step, forced gain]]
    "Normal Day"     : [[-800,-600,-400,-250,120,300], 800, ["-250",120]], // Normal
    "Event Discount" : [[-600,-450,-400,-300,-250,120,300], 800, ["-250,-400",120]], // 75% off Moves
    "DMax Event"     : [[-800,-600,-450,-300,300,820], 1600, ["-800",820]], // 8xS, 1xW, discount
    "GMax Event"     : [[-800,-600,-400,600,820], 1600, ["-800",820]], // 8xS, 2xW, no discount
    "June 2025 GMax Weekday" : [[-800,-600,-400,-250,300,820], 1600, ["-250",820]], // 8xS, no W, no disc
    "June 2025 GMax Weekend" : [[-800,-600,-400,300,820], 1600, ["-800",820]], // 8xS, no W, GMax around
};

const SHORTCUTS = {
    "NORMAL"   : "Normal Day",
    "DISCOUNT" : "Event Discount",
    "DMAX"     : "DMax Event",
    "GMAX"     : "GMax Event",
    "GMAX_J25_DAY" :  "June 2025 GMax Weekday",
    "GMAX_J25_END" :  "June 2025 GMax Weekend",
};
Object.entries(SHORTCUTS).forEach(([key,val]) => {
    SHORTCUTS[val] = key; // make bidirectional
});

function route(fromN, toN_min, toN_max, move, daily, hold, autoTriggers, autoGain, maxStep) {
    function makeKey(n,day,part) { return `${n}~${day}~${part}`; }
    function getKey(key) { return key.split("~").map(Number); }
    
    if ((fromN >= toN_min) && (fromN <= toN_max)) return [true,fromN, [], 0, 0];
    
    let inc = {};
    let key = makeKey(fromN,1,0)
    inc[0] = {[key]:[]}
    let reached = new Set([key]);
    let idx = 0;

    goalKeys = {}
    bestDay = Infinity
    while (idx < maxStep) {
        newInc = {};
        for (let [key,path] of Object.entries(inc[idx])) {
	    const [N,day,part] = getKey(key);
            for (mov of move) {
                if ( (mov > 0 && N >= hold) || (mov < 0 && (N+mov < 0)) ) continue
                let newN = N + mov;
		let newPart = part
		let newDay = day
		let triggered = false
		if (autoTriggers.includes(mov) && (N < hold)) {
		    triggered = true
		    newN += autoGain
		    newPart += autoGain
		}
		if ((mov > 0) || triggered) {
		    if (newPart >= daily) {
			newDay += 1
			newPart -= daily
		    }
		    newPart += ((mov>0) ? mov : 0)
		}
		let newKey = makeKey(newN, newDay, newPart)
		if (reached.has(newKey) || newDay > bestDay) continue
                let newPath = (triggered ? path.concat([mov,"!",autoGain]) : path.concat([mov]));
                if ((newN >= toN_min) && (newN <= toN_max)) {
		    goalKeys[newKey] = idx+1
		    bestDay = Math.min(bestDay, newDay)
                    //return [true, newN, newPath, newDay, newPart]
		}
                reached.add(newKey)
		newInc[newKey] = newPath
	    }
	}
        idx += 1
	inc[idx] = newInc;
    }
    //console.log(`All Unique routes to goal: ${Object.keys(goalKeys)}`)
    for (let [key,idx] of Object.entries(goalKeys)) {
	let [N,day,part] = getKey(key)
	if (day == bestDay) {
	    return [true,N,inc[idx][key],day,part]
	}
    }
    return [false,NaN,[],NaN,NaN]
}

function route2String(routeInfo) {
    let [reached, end, path, day, part] = routeInfo;
    if (!reached) {
	s = `Unable to go from ${Data.init} to ${Data.goalStr} particles`
	    +`<br>Using the following Steps:<br>${Data.steps}`
    } else {
	let pathStr = (`${Data.init} » [`+path.join("] » [")+`] » ${end}`).replaceAll("] » [!] » [",",");
	s = `To get from ${Data.init} to ${end} particles:`
	    +`<br><u>${pathStr}</u>`
	    + ((day==0) ? "<br>No particle collecting required!"
	       : `<br>${day} Day${day>1?'s':''} of particle collecting required`)
	if (path.includes("!") && !Data.steps.includes(Data.forcedGain)) {
	    s += `<br>Warning: Forced Collection [${Data.forcedGain}] is not a selected step amount`
	}
    }
    return s;
}

const Data = {
    init : null,
    daily : null,
    hold : null,
    iterations : null,
    forcedGain : null,

    goalStr : null,
    customStr : null,
    forceStr : null,
    
    steps : [],
    forceTriggers : [],
    
    goalMin : null,
    goalMax : null,

    mappings : {
	"i" : ["init", "init", "N"],
	"d" : ["daily", "daily", "N"],
	"h" : ["hold", "hold", "N"],
	"a" : ["forcedGain", "autoGain", "N"],
	"m" : ["iterations", "maxStep", "N"],
	"g" : ["goalStr", "goal", "T"],
	"c" : ["customStr", "custom", "T"],
	"t" : ["forceStr", "autoTrigger","T"],
	// Step Table
    },
    preset_fields : ["daily", "autoTrigger", "autoGain"],

    populateArrayFromCSL(arr, CSL) {
	if (CSL) {
	    CSL.split(",").forEach((n)=>{
		let nn = Number(n);
		if (!isNaN(nn) && !arr.includes(nn)) arr.push(nn)
	    });
	}
    },
    
    readForm() {
	// reading inputs
	for (const [key, val] of Object.entries(this.mappings)) {
	    switch (val[2]) {
	    case ("N"):
		this[val[0]] = $S(`#${val[1]}`).valueAsNumber;
		break;
	    case ("T"):
		this[val[0]] = $S(`#${val[1]}`).value;
		break;
	    case ("B"):
		this[val[0]] = $S(`#${val[1]}`).checked;
		break;
	    }
	}
	// goalmin/max
	let goal = Number(this.goalStr);
	this.goalMin = goal;
	this.goalMax = goal;
	if (isNaN(goal)) {
	    let goals = this.goalStr.split(/[-–—]/i).map(Number)
	    if (goals.length != 2 || isNaN(goals[0]) || isNaN(goals[1])) {
		return [false,
			`Unable to parse goal ${$S('#goal').value} to number (N) or range (N1-N2).`];
	    }
	    this.goalMin = Math.min(...goals);
	    this.goalMax = Math.max(...goals);
	}
	// steps & force
	this.steps = [];
	this.forceTriggers = [];
	this.populateArrayFromCSL(this.forceTriggers, this.forceStr)
	$Sall('#StepTable tr:has(input)').forEach((r)=>{
	    if (!r.querySelector('input').checked) return
	    this.steps.push(Number(r.children[1].innerText))
	});
	this.populateArrayFromCSL(this.steps, this.customStr);
	this.steps.sort((a, b) => (b-a));
	return [true,""]
    },

    encode() {
	s = "?"
	active_preset = $S('.preset-active')
	if (active_preset) {
	    console.log(active_preset);
	    s += `preset=${SHORTCUTS[active_preset.innerText]}&`
	}
	for (const [key, val] of Object.entries(this.mappings)) {
	    if (active_preset && this.preset_fields.includes(val[1])) continue;
	    v = this[val[0]]
	    s += `${key}=${(val[2]=='B' ? 1*v : v)}&`
	}
	// encode steps (if not preset)
	if (active_preset) return s;
	let steps = []
	$Sall('#StepTable tr:has(input)').forEach((r)=>{
	    if (!r.querySelector('input').checked) return
	    steps.push(Number(r.children[1].innerText))
	});
	if (steps.length > 0) s += `steps=${steps.join(",")}`;
	
	return s;
    },

    update(property, value) {
	let [_, id, typ] = this.mappings[property];
	switch (typ) {
	case ("B"):
	    $S(`#${id}`).checked = value=="1";
	    break;
	default:
	    $S(`#${id}`).value = value;
	}
    },

    loadFromURL() {
	URL = window.location.href.split("?")[1];
	if (URL) {
	    var values = URL.split("&");
	    for (i=0; i<values.length; i++) {
		if (0==values[i].length) continue;
		let [prop, val] = values[i].split("=");
		if (prop=="preset" && (val.toUpperCase() in SHORTCUTS)) {
		    // load preset
		    setPreset(SHORTCUTS[val.toUpperCase()]);
		} else if (prop=="steps") {
		    // check appropriate steps
		    let steps = val.split(",").map(Number);
		    $Sall('#StepTable tr:has(input)').forEach((r)=>{
			let checkbox = r.querySelector('input');
			let rowNum = Number(r.children[1].innerText)
			checkbox.checked = steps.includes(rowNum);
		    });
		} else {
		    this.update(prop, val);
		}
	    }
	}
    },

    saveToURL() {
	this.readForm();
	uri = window.location.href.split("?")[0] + this.encode();
	return uri;
	// window.history.pushState(null, "", uri);
    },
}

function runPage() {
    let [valid, err] =  Data.readForm();
    if (!valid) {
	$S('#output').innerHTML = err;
	return;
    }
    // do the math
    routeInfo = route(Data.init, Data.goalMin, Data.goalMax, Data.steps, Data.daily,
		      Data.hold, Data.forceTriggers, Data.forcedGain, Data.iterations);
    // print output
    $S('#output').innerHTML = route2String(routeInfo);
}

function exportURL() {
    uri = Data.saveToURL();
    $S('#output').innerHTML = 'Use this link to return to these settings:<br>'
	+`<a href=${uri}>${uri}</a>`;
}

function setPreset(name) {
    if (!(name in PRESETS)) return
    const [steps, daily, [autoTrigger,autoGain]] = PRESETS[name];
    $Sall('#StepTable tr:has(input)').forEach((r)=>{
	let checkbox = r.querySelector('input');
	let rowNum = Number(r.children[1].innerText)
	checkbox.checked = steps.includes(rowNum);
    });
    $S('#daily').value = daily;
    $S('#autoTrigger').value = autoTrigger;
    $S('#autoGain').value = autoGain;
    $Sall("#PresetTable button").forEach((b)=>{
	if (b.innerText == name) {
	    b.classList.add("preset-active");
	} else {
	    b.classList.remove("preset-active");
	}
    });
}

function disableActivePreset() {
    const btn = $S('.preset-active')
    if (btn) btn.classList.remove('preset-active')
}

window.addEventListener('load', function() {
    // Row-Based toggling for Step checkboxes
    $S('#StepTable').addEventListener('click', (e) => {
	if (e.target.tagName === 'INPUT' || e.target.tagName==='TABLE') return;
	const row = e.target.tagName === 'TR' ? e.target : e.target.parentNode;
	const childCheckbox = row.querySelector('input[type="checkbox"]');
	if (childCheckbox) childCheckbox.checked = !childCheckbox.checked;
	disableActivePreset();
    });

    // Make presets update matching StepTable rows
    $Sall("#PresetTable button").forEach((b)=>{
	b.addEventListener('click', (e)=>{
	    setPreset(e.target.innerText);
	});
    });

    // Make changes to Daily Limit and Force disable preset-active
    Data.preset_fields.forEach((t)=>{
	$S(`#${t}`).addEventListener('change', (e)=>{
	    disableActivePreset();
	});
    });

    // Get page to expected state
    setPreset("Normal Day");
    Data.loadFromURL();
    runPage();
});
