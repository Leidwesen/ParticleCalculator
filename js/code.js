function $S(selector) { return document.querySelector(selector); }
function $Sall(selector) { return document.querySelectorAll(selector); }

// TODO
// 'show all routes' option
// finite quantity of a given step?

const PRESETS = {
    "Normal Day"     : [[-800,-600,-400,-250,120,300], 800, ["-250",120]],
    "Event Discount" : [[-600,-450,-400,-300,-250,120,300], 800, ["-250,-400",120]],
    "DMax Event"     : [[-800,-600,-450,-300,300,820], 1600, ["-800",820]],
    "GMax Event"     : [[-800,-600,-450,-300,600,820], 1600, ["-800",820]]
};
const SHORTCUTS = {
    "NORMAL" :  "Normal Day",
    "DISCOUNT" : "Event Discount",
    "DMAX" : "DMax Event",
    "GMAX" : "GMax Event"
};

function makeKey(n,day,part) { return `${n}~${day}~${part}`; }
function getKey(key) { return key.split("~").map(Number); }

function route(fromN, toN_min, toN_max, move, daily, hold, autoTriggers, autoGain, maxStep) {
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

function populateArrayFromCSL(arr, CSL) {
    if (CSL) {
	CSL.split(",").forEach((n)=>{
	    let nn = Number(n);
	    if (!isNaN(nn) && !arr.includes(nn)) arr.push(nn)
	});
    }
}

function runPage() {
    // yoink the inputs, iterate steps, parse custom
    const init = $S('#init').valueAsNumber,
	  goalValue = $S('#goal').value,
	  goal = Number(goalValue),
	  daily = $S('#daily').valueAsNumber,
	  hold = $S('#hold').valueAsNumber,
	  maxStep = $S('#maxStep').valueAsNumber,
	  autoGain = $S('#autoGain').valueAsNumber,
	  steps = [],
	  autoTriggers = [];
    let goalMin,
	goalMax;
    if (isNaN(goal)) {
	// lets goal also function as a target range of values
	let goals = goalValue.split(/[-–—]/i).map(Number)
	if (goals.length != 2 || isNaN(goals[0]) || isNaN(goals[1])) {
	    $S('#output').innerHTML = `Unable to parse goal ${$S('#goal').value} to number (N) or range (N1-N2).`
	    return;
	}
	goalMin = Math.min(...goals);
	goalMax = Math.max(...goals);
    } else {
	goalMin = goal;
	goalMax = goal;
    }
    $Sall('#StepTable tr:has(input)').forEach((r)=>{
	if (!r.querySelector('input').checked) return
	steps.push(Number(r.children[1].innerText))
    });
    populateArrayFromCSL(steps, $S("#custom").value);
    steps.sort((a, b) => (b-a));
    populateArrayFromCSL(autoTriggers, $S("#autoTrigger").value);
    // do the math
    [reached, end, path, day, part] = route(init, goalMin, goalMax, steps, daily,
					    hold, autoTriggers, autoGain, maxStep);
    // print output
    if (!reached) {
	$S('#output').innerHTML = `Unable to go from ${init} to ${goalValue} particles<br>Using the following Steps:<br>${steps}`
    } else {
	let pathStr = (`${init} » [` + path.join("] » [") + `] » ${end}`).replaceAll("] » [!] » [",",");
	$S('#output').innerHTML = `To get from ${init} to ${end} particles:`
	    +`<br><u>${pathStr}</u>`
	    + ((day==0) ? "<br>No particle collecting required!" : `<br>${day} Day${day>1?'s':''} of particle collecting required`)
    }
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
}

window.addEventListener('load', function() {
    // Row-Based toggling for Step checkboxes
    $S('#StepTable').addEventListener('click', (e) => {
	if (e.target.tagName === 'INPUT' || e.target.tagName==='TABLE') return;
	const row = e.target.tagName === 'TR' ? e.target : e.target.parentNode;
	const childCheckbox = row.querySelector('input[type="checkbox"]');
	if (childCheckbox) childCheckbox.checked = !childCheckbox.checked;
    });

    // Make presets update matching StepTable rows
    $Sall("#PresetTable button").forEach((b)=>{
	b.addEventListener('click', (e)=>{
	    setPreset(e.target.innerText);
	});
    });

    // allow for any starting preset to be picked via URL (normal default)
    let preset = window.location.href.match(/preset=([^&]*)/i)
    if (!preset || !(preset[1].toUpperCase() in SHORTCUTS)) {
	setPreset("Normal Day");
    } else {
	setPreset(SHORTCUTS[preset[1].toUpperCase()]);
    }
    
    runPage();
});
