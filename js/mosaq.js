// ----- facebook init function ----------------------------------------
window.fbAsyncInit = function () {
    FB.init({
        appId: '150444028655655',
        xfbml: true,
        version: 'v2.5'
    });
};
(function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) { return; }
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// ----- prevent backspace from navigating to previous page -------------
window.onkeydown = function (event) {
    if (event.keyCode == 8 && event.target.tagName == 'BODY') 
        event.preventDefault();
}

// ----- declare variables ----------------------------------------------
var canvas = document.getElementById('myCanvas');
var context = canvas.getContext('2d');
var mosaicCanvas = document.createElement("canvas");                // generated tiled mosaic
var revealCanvas = document.createElement("canvas");
var canvasT = { aa: 1, ab: 0, ac: 0, ba: 0, bb: 1, bc: 0 };         // canvas transform
var canvasInvT = { aa: 1, ab: 0, ac: 0, ba: 0, bb: 1, bc: 0 };      // canvas inverse transform
var cW = 1920;                                                      // mosaic base image width
var cH = 1080;                                                      // mosaic base image height
var divisions = 128;                                                //
var zoom = { offX: 0, offY: 0, scale: 1 };
var baseImage = null;
var tileImages = null;
var TilesUsed = {};                                                 // stats of tiles used in current mosaic
var stepFns = [];                                                   // list of functions 

var mode = "view";                                                  // view, deleteTiles, addTiles
var brushRadius = 0;

var crossIco = new Image();                                         // the cross icon
crossIco.src = 'cross.png';

var revealPosns = {};                                               // positions to reveal the underlying image

var navMinimizeFlags = [true,true,true];

/**
* MAIN LOOP executed every frame
*/
function onEnterFrame() {
    adjustCanvasTransform(cW, cH);
    for (var i = stepFns.length - 1; i > -1; i--) {
        var fn = stepFns[i];
        if (fn())
            stepFns.splice(stepFns.indexOf(fn), 1);
    }
}//endfunction
var intId = setInterval(onEnterFrame, 33);

loadTilesSheet("tiles/tiles256.jpg", 16, function (TileImages) {        // load tiles sheet
    loadBlob("imgs/" + Math.floor(Math.random() * 256) + ".jpg", function (blob) {      // load image blob
        baseImage = new Image();
        baseImage.onload = function (ev) {
            initMosaicNavInterractions();
            doMosaic(baseImage, TileImages);
        }
        baseImage.src = window.URL.createObjectURL(blob);
    },"LOADING BASE IMAGE");
});

/**
* loads in a sheet of tile images to cut up and use as tile images, populates tileImages
*/
function loadTilesSheet(url, divisions, callBack) {
    loadBlob(url, function (blob) {
        var tilesImage = new Image();
        tilesImage.onload = function (ev) {
            prog = 1;
            var tilesCanvas = document.createElement("canvas");
            tilesCanvas.width = tilesImage.width;
            tilesCanvas.height = tilesImage.height;
            tilesCanvas.getContext("2d").drawImage(tilesImage, 0, 0);
            var tileImages = {};
            var tileW = tilesImage.width / divisions;
            var tileH = tilesImage.height / divisions;
            for (var x = 0; x < divisions; x++)
                for (var y = 0; y < divisions; y++) {
                    var tileDat = tilesCanvas.getContext("2d").getImageData(x * tileW, y * tileH, tileW, tileH);
                    var tile = document.createElement("canvas");
                    tile.width = tileW;
                    tile.height = tileH;
                    var ctx = tile.getContext("2d");
                    ctx.putImageData(tileDat, 0, 0);
                    tileImages["(" + x + "," + y + ").jpg"] = createImageMipsObj(tile);
                }
            if (callBack != null) callBack(tileImages);
        }
        tilesImage.src = window.URL.createObjectURL(blob);
    },"LOADING TILE IMAGES");
}//endfunction

/**
* loads and returns a Blob object
*/
function loadBlob(url, callBack, txt)
{
    var prog = 0;
    var rotAng = 0;

    var xmlHTTP = new XMLHttpRequest();
    xmlHTTP.open('GET', url, true);
    xmlHTTP.responseType = 'arraybuffer';
    xmlHTTP.onload = function (e) {
        if (callBack != null) callBack(new Blob([xmlHTTP.response]));
        prog = 1;
    };
    xmlHTTP.onprogress = function (e) {
        prog = e.loaded / e.total;
    };
    xmlHTTP.send();

    stepFns.push(function () {
        context.lineWidth = cW / 30;
        context.beginPath();
        context.arc(cW / 2, cH / 2, Math.min(cW / 5, cH / 5), 0, 2 * Math.PI);
        context.globalCompositeOperation = "screen";
        context.strokeStyle = '#999999';
        context.stroke();
        context.lineWidth = cW / 45;
        context.beginPath();
        rotAng += 0.03;
        context.arc(cW / 2, cH / 2, Math.min(cW / 5, cH / 5), rotAng, 2 * Math.PI * prog + rotAng);
        context.globalCompositeOperation = "source-over";
        context.strokeStyle = '#FFFFFF';
        context.stroke();

        context.font = "80px Arial";
        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.shadowColor = "black";
        context.shadowOffsetY = 5;
        context.shadowBlur = 8;
        context.fillText(Math.floor(prog * 100), cW / 2, cH / 2);

        if (txt != null)
        {
            context.font = "40px Arial";
            context.fillText(txt, cW / 2, cH*4/5);
        }
        context.shadowOffsetY = 0;
        context.shadowBlur = 0;

        return prog >= 1;
    });
}//endfunction

/**
* initialize main mosaic interractions
*/
function initMosaicNavInterractions()
{
    // ----- add navigation div if not found
    if (document.getElementById("navBar") != null) return;
    
	// ----- enable nav div drag functionality ---------------------------------
	var navDiv = document.createElement("div");
	navDiv.id = "navBar";
	document.body.appendChild(navDiv);
	var offset = null;
	function divMove(e) {
		var rect = navDiv.getBoundingClientRect();
		navDiv.style.top = Math.max(5, Math.min(window.innerHeight - rect.height - 5, e.clientY + offset.y)) + 'px';
		navDiv.style.left = Math.max(5, Math.min(window.innerWidth - rect.width - 5, e.clientX + offset.x)) + 'px';
	}
	function mouseUp() {
		window.removeEventListener('mousemove', divMove, true);
	}
	function mouseDown(e) {
		var rect = navDiv.getBoundingClientRect();
		offset = { x: rect.left - e.clientX, y: rect.top - e.clientY };
		window.addEventListener('mousemove', divMove, true);
	}
	function resizeHandler(e) {
		var rect = navDiv.getBoundingClientRect();
		navDiv.style.top = Math.max(5,Math.min(window.innerHeight - rect.height - 5, rect.top)) + 'px';
		navDiv.style.left = Math.max(5,Math.min(window.innerWidth - rect.width - 5, rect.left)) + 'px';
	}
	navDiv.addEventListener('mousedown', mouseDown, false);
	window.addEventListener('mouseup', mouseUp, false);
	window.addEventListener('mouseleave', mouseUp, false);
	window.addEventListener('resize', resizeHandler, false);

	// ----- define navDiv sections ------------------------------------------
	navDiv.innerHTML =  "<div class='navBarSection' id='navBarImageDiv'></div><br/>" +
        			    "<div class='navBarSection' id='navBarTilesDiv'></div><br/>" +
                        "<div class='navBarSection' id='navBarSettingsDiv'></div>";
	
    // ----- handle drop base image 
	function handleBaseFileDrop(ev) {
		ev.stopPropagation();
		ev.preventDefault();
		var files = ev.dataTransfer.files;
		var baseImageFile = null;
		for (var i = 0; i < files.length; i++) {
			var f = files[i];
			if (f.type.indexOf("image") != -1)
				baseImageFile = f;
		}
		var fr = new FileReader();
		fr.onload = function () {
			baseImage = new Image();
			baseImage.onload = function () { doMosaic(baseImage, tileImages); }
			baseImage.src = fr.result;
		};
		fr.readAsDataURL(baseImageFile);    // begin reading
	}
	function handleFileDragOver(ev) {
		ev.stopPropagation();
		ev.preventDefault();
		ev.dataTransfer.dropEffect = 'copy';
	}
	document.getElementById("navBarImageDiv").addEventListener('dragover', handleFileDragOver, false);
	document.getElementById("navBarImageDiv").addEventListener('drop', handleBaseFileDrop, false);
    
    // ----- handler drop tiles image
	function handleTilesFileDrop(ev) {
	    ev.stopPropagation();
	    ev.preventDefault();
	    var files = ev.dataTransfer.files;
	    
	    var i = 0;
	    function loadNext()
	    {
	        if (i >= files.length) {
	            doMosaic(baseImage, tileImages);
	        }
	        else {
	            var f = files[i++];
	            if (f.type.indexOf("image") != -1) {
	                var fr = new FileReader();
	                fr.onload = function () {
	                    var tileImg = new Image();
	                    tileImg.onload = function () {
	                        tileImages[new Date().getTime() + "."] = createImageMipsObj(tileImg);
	                        loadNext();
	                    }
	                    tileImg.src = fr.result;
	                };
	                fr.readAsDataURL(f);    // begin reading
	            }
	            else
	                loadNext();
	        }
	    }//endfunction
	    loadNext();
	}
	document.getElementById("navBarTilesDiv").addEventListener('dragover', handleFileDragOver, false);
	document.getElementById("navBarTilesDiv").addEventListener('drop', handleTilesFileDrop, false);

	window.onresize = function(ev) {updateMosaicNav();};

	// ----- enable mosaic zoom and drag functionality ------------------------
	var prevMousePt = null;
	var canvasMousePosn = { x: 0, y: 0 };
	function canvasDragHandler(e) {
		var canvSc = getCanvasScale();
		zoom.offX += (e.clientX - prevMousePt.x) / canvSc;
		zoom.offY += (e.clientY - prevMousePt.y) / canvSc;
		restrictZoomOffset();
		prevMousePt = { x: e.clientX, y: e.clientY };
	}
	function addRemTilesHandler(e)
	{
	    var btw = baseImage.width / divisions;
	    var bth = baseImage.height / divisions;
	    var rtw = revealCanvas.width / divisions;
	    var rth = revealCanvas.height / divisions;
	    var csrPosn = canvasPosition(canvasMousePosn.x, canvasMousePosn.y);
	    csrPosn.x = Math.floor(csrPosn.x / rtw);
	    csrPosn.y = Math.floor(csrPosn.y / rth);
	    var changed = false;
	    var br = Math.floor(brushRadius);
	    for (var i = -br; i <= br; i++)
	        for (var j = -br; j <= br; j++)
	        {
	            var c = csrPosn.x + j;
	            var r = csrPosn.y + i;
	            if (mode == "deleteTiles" && revealPosns[c + ":" + r] == null) {
	                revealPosns[c + ":" + r] = 1;
	                changed = true;
	            }
	            if (mode == "addTiles" && revealPosns[c + ":" + r] != null) {
	                delete revealPosns[c + ":" + r];
	                changed = true;
	            }
	        }

	    if (changed) {
	        var ctx = revealCanvas.getContext("2d");
	        ctx.drawImage(mosaicCanvas, 0, 0);
	        var revealed = Object.getOwnPropertyNames(revealPosns);
	        for (var i = revealed.length - 1; i > -1; i--) {
	            var c = parseInt(revealed[i].split(":")[0]);
	            var r = parseInt(revealed[i].split(":")[1]);
	            ctx.drawImage(baseImage,c*btw,r*bth,btw,bth,c*rtw,r*rth,Math.ceil(rtw),Math.ceil(rth));
	        }
	    }
	}
	function canvasMouseDownHandler(e)
	{
	    prevMousePt = { x: e.clientX, y: e.clientY };
	    if (mode == "view")
	        canvas.addEventListener('mousemove', canvasDragHandler);
	    else {
	        canvas.addEventListener('mousemove', addRemTilesHandler);
	        addRemTilesHandler(null);
	    }
	}
	function canvasMouseUpHandler(e) 
	{
	    canvas.removeEventListener('mousemove', canvasDragHandler);
	    canvas.removeEventListener('mousemove', addRemTilesHandler);
	}
	function canvasMouseWheelHandler(e)
	{
	    if (mode == "view") {
	        if (e.wheelDelta)
	            zoom.scale = Math.min(10, Math.max(1, zoom.scale + e.wheelDelta / 1000));
	        else if (e.detail)
	            zoom.scale = Math.min(10, Math.max(1, zoom.scale - e.detail / 20));
	        restrictZoomOffset();
	    }
	    else
	    {
	        if (e.wheelDelta)
	            brushRadius = Math.min(10, Math.max(0, brushRadius + e.wheelDelta / 1000));
	        else if (e.detail)
	            brushRadius = Math.min(10, Math.max(0, brushRadius - e.detail / 20));
	    }

	}
	function canvasMouseMoveHandler(e) {
		canvasMousePosn.x = e.clientX;
		canvasMousePosn.y = e.clientY;
	}
	function restrictZoomOffset()
	{
		var maxOffX = (zoom.scale-1)*0.5*cW/zoom.scale;
		var maxOffY = (zoom.scale-1)*0.5*cH/zoom.scale;
		if (zoom.offX<-maxOffX) zoom.offX=-maxOffX;
		if (zoom.offX> maxOffX) zoom.offX= maxOffX;
		if (zoom.offY<-maxOffY) zoom.offY=-maxOffY;
		if (zoom.offY> maxOffY) zoom.offY= maxOffY;
	}
	canvas.addEventListener('mousedown', canvasMouseDownHandler);
	canvas.addEventListener('mouseup', canvasMouseUpHandler);
	canvas.addEventListener('mouseleave', canvasMouseUpHandler);
	canvas.addEventListener('mousewheel', canvasMouseWheelHandler);
	canvas.addEventListener('DOMMouseScroll', canvasMouseWheelHandler); // just for FireFox!
	canvas.addEventListener('mousemove', canvasMouseMoveHandler);

	// ----- draw mosaicCanvas to screen every frame
	stepFns.push(function ()
	{
	    context.drawImage(revealCanvas, 0, 0, revealCanvas.width, revealCanvas.height, 0, 0, cW, cH);
	    if (mode != "view") 
	    {
	        var rtw = revealCanvas.width / divisions;
	        var rth = revealCanvas.height / divisions;
	        var csrPosn = canvasPosition(canvasMousePosn.x, canvasMousePosn.y);
	        csrPosn.x = Math.floor(csrPosn.x / rtw);
	        csrPosn.y = Math.floor(csrPosn.y / rth);
            context.strokeStyle = "#00FFFF";
            context.beginPath();
            context.rect((csrPosn.x - brushRadius) * rtw, (csrPosn.y - brushRadius) * rth, (brushRadius * 2 + 1) * rtw, (brushRadius * 2 + 1) * rth);
            context.stroke();
            var bRad = Math.floor(brushRadius);
            context.strokeStyle = "#FF00FF";
            context.beginPath();
            context.rect((csrPosn.x - bRad) * rtw, (csrPosn.y - bRad) * rth, (bRad * 2 + 1) * rtw, (bRad * 2 + 1) * rth);
            context.stroke();
	    }

		return false;   // false -> do not remove from stepFns
	});

}//endfunction

/**
* Sets the contents of the base image div of the nav bar
*/
function updateBaseImageDiv(minimize) {

    navMinimizeFlags[0] = minimize;

    var imgDiv = document.getElementById("navBarImageDiv");
    if (minimize)
    {
        imgDiv.innerHTML = "<b>Base Image</b><img img id='navBarImageMaximizeIco' class='navSectionIcoBtn' src='maximize.png' />";
        var maxBtn = document.getElementById('navBarImageMaximizeIco');
        maxBtn.style.display = "inline";
        maxBtn.onclick = function () { updateBaseImageDiv(!navMinimizeFlags[0]);}
    }
    else
    {
        imgDiv.innerHTML = "<b>Base Image</b>" +
        "<img img id='navBarImageMinimizeIco' class='navSectionIcoBtn' src='minimize.png' />" +
        "<br\><canvas id='baseImageThumbCanvas' width='200px' height='100px'></canvas>" +
        "<div class='navSectionFooter'>Drop your base image here.</div>";
        var minBtn = document.getElementById('navBarImageMinimizeIco');
        minBtn.style.display = "inline";
        minBtn.onclick = function () { updateBaseImageDiv(!navMinimizeFlags[0]); }

        var sc = Math.min(window.innerWidth / cW, window.innerHeight / cH);
        var thumbCanvas = document.getElementById("baseImageThumbCanvas");
        thumbCanvas.width = cW * sc*0.15;
        thumbCanvas.height = cH * sc*0.15;
        thumbCanvas.getContext("2d").drawImage(baseImage, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }
}//endfunction

/**
* Sets the contents of the tiles images div of the nav bar
*/
function updateTileImagesDiv(minimize) {

    navMinimizeFlags[1] = minimize;

    var tilesDiv = document.getElementById("navBarTilesDiv");
    if (minimize)
    {
        tilesDiv.innerHTML = "<b>Tile Images</b><img img id='navBarTilesMaximizeIco' class='navSectionIcoBtn' src='maximize.png' />";
        var maxBtn = document.getElementById('navBarTilesMaximizeIco');
        maxBtn.style.display = "inline";
        maxBtn.onclick = function () { updateTileImagesDiv(!navMinimizeFlags[1]); }
    }
    else
    {
    	var tdnum = 7;
    	var sc = Math.min(window.innerWidth * 0.00015, window.innerHeight * 0.00015);
    	var sc = Math.min(window.innerWidth / cW, window.innerHeight / cH);
        tilesDiv.innerHTML = "<b>Tile Images</b>" +
                                "<img img id='navBarTilesMinimizeIco' class='navSectionIcoBtn' src='minimize.png' />" +
                                "<img id='trashBinIco' class='navSectionIcoBtn' src='trashBin.png' />" +
                                "<img img id='selectAllIco' class='navSectionIcoBtn' src='selectAll.png' /><br/>" +
                                "<canvas id='tileImagesThumbCanvas'></canvas>" +
                                "<div class='navSectionFooter'>Drop your tile images here.</div>";
        var minBtn = document.getElementById('navBarTilesMinimizeIco');
        minBtn.style.display = "inline";
        minBtn.onclick = function () { updateTileImagesDiv(!navMinimizeFlags[1]); }

        // ----- tiles div click interractions -----------------------
        var imageKeys = Object.getOwnPropertyNames(tileImages);
        var numCols = Math.ceil(Math.sqrt(imageKeys.length));
        var numRows = Math.ceil(imageKeys.length / numCols);
        var w = (cW * sc * 0.15 * 0.2 + 3) * numCols;
        var gap = 3;
        var tilesSourceCanvas = generateTilesCols(tileImages, TilesUsed, w, numCols, gap);
        var tilesCanvas = document.getElementById("tileImagesThumbCanvas");
        tilesCanvas.width = tilesSourceCanvas.width;
        tilesCanvas.height = tilesSourceCanvas.height;
        tilesCanvas.style.cursor = "pointer";
        var Selected = [];
        tilesCanvas.onclick = function (ev) {
            var imageKeys = Object.getOwnPropertyNames(tileImages);
            var rect = tilesCanvas.getBoundingClientRect();

            if (ev != null) {
                var px = ev.clientX - rect.left;
                var py = ev.clientY - rect.top;
                var idx = Math.floor(py / tilesCanvas.height * numRows) * numCols + Math.floor(px / tilesCanvas.width * numCols);
                if (Selected.indexOf(idx) != -1)
                    Selected.splice(Selected.indexOf(idx), 1);
                else
                    Selected.push(idx);
            }

            // ----- updates selected tiles for deleting
            var trashIco = document.getElementById("trashBinIco");
            var selAllBtn = document.getElementById("selectAllIco");
            var tileW = (w - gap * (numCols - 1)) / numCols;
            var tileH = tileW / cW * cH;
            var tilesCtx = tilesCanvas.getContext("2d");
            tilesCtx.drawImage(tilesSourceCanvas, 0, 0);
            for (var i = Selected.length - 1; i > -1; i--) {
                idx = Selected[i];
                px = (idx % numCols) * (tileW + 3);
                py = Math.floor(idx / numCols) * (tileH + 3);
                tilesCtx.drawImage(crossIco, 0, 0, crossIco.width, crossIco.height, px, py, tileW, tileH);
            }
            if (Selected.length > 0) {
                selAllBtn.style.display = "inline";
                trashIco.style.display = "inline";
            }
            else {
                selAllBtn.style.display = "none";
                trashIco.style.display = "none";
            }
        }
        tilesCanvas.onclick(null);  // trigger initial drawing of tiles
        document.getElementById("trashBinIco").onclick = function () {
            for (var i = Selected.length - 1; i > -1; i--)
                delete tileImages[imageKeys[Selected[i]]];
            doMosaic(baseImage, tileImages);
        }
        document.getElementById("selectAllIco").onclick = function () {
            if (Selected.length >= imageKeys.length)
                Selected = [];
            else {
                Selected = [];
                for (var i = 0; i < imageKeys.length; i++)
                    Selected.push(i);
            }
            tilesCanvas.onclick(null);
        }
    }
}//endfunction

/**
* Sets the contents of the tools and settings div of the nav bar
*/
function updateSettingsDiv(minimize) {

    navMinimizeFlags[2] = minimize;

    var settingsDiv = document.getElementById("navBarSettingsDiv");
    if (minimize) {
        settingsDiv.innerHTML = "<b>Tools</b><img img id='navBarSettingsMaximizeIco' class='navSectionIcoBtn' src='maximize.png' />";
        var maxBtn = document.getElementById('navBarSettingsMaximizeIco');
        maxBtn.style.display = "inline";
        maxBtn.onclick = function () { updateSettingsDiv(!navMinimizeFlags[2]); }
    }
    else
    {
        settingsDiv.innerHTML = "<b>Tools</b>" +
                                "<img img id='navBarSettingsMinimizeIco' class='navSectionIcoBtn' src='minimize.png' />" +
                                "<br/><b>Size: </b><input type='button' id='dimensionsBtn' value='" + cW + "x" + cH + "'><br/>" +
                                "<b>Divisions: </b><input type='button' id='divisionsBtn' value='"+divisions+"'><br/>" +
                                "<img id='handIco' class='navToolsIcoBtn' src='hand.png' /><img id='tilePlusIco' class='navToolsIcoBtn' src='tilePlus.png' /><img id='tileMinusIco' class='navToolsIcoBtn' src='tileMinus.png' /><br/>" +
                                "<input type='button' id='saveBtn' value='Save Mosaic'><br/>" +
                                "<div id='tilesUsedFooter' class='navSectionFooter'>Tiles Used : " + Object.getOwnPropertyNames(TilesUsed).length + " of " + Object.getOwnPropertyNames(tileImages).length + "</div>";
        var minBtn = document.getElementById('navBarSettingsMinimizeIco');
        minBtn.style.display = "inline";
        minBtn.onclick = function () { updateSettingsDiv(!navMinimizeFlags[2]); mode = "view";}

        // ----- dimensions button interractions ----------------------
        var dimsBtn = document.getElementById('dimensionsBtn');
        document.getElementById('dimensionsBtn').onclick = function () {
            var wIn = document.createElement("input");
            wIn.type = "number";
            wIn.style.width = "50px";
            wIn.defaultValue = cW;
            var hIn = document.createElement("input");
            hIn.type = "number";
            hIn.style.width = "50px";
            hIn.defaultValue = cH;
            var okBtn = document.createElement("input");
            okBtn.type = "button";
            okBtn.defaultValue = "Ok";
            var whSpan = document.createElement("span");
            whSpan.appendChild(wIn);
            whSpan.appendChild(document.createTextNode("x"));
            whSpan.appendChild(hIn);
            var whDiv = document.createElement("div");
            whDiv.appendChild(whSpan);
            whDiv.appendChild(okBtn);
            dimsBtn.parentNode.insertBefore(whDiv, dimsBtn.nextSibling);
            dimsBtn.style.display = "none";
            okBtn.onclick = function () {
                cW = Math.min(8192, Math.max(divisions, wIn.value));
                cH = Math.min(8192, Math.max(divisions, hIn.value));
                doMosaic(baseImage, tileImages);
            }
        }
        // ----- division button interractions ------------------------
        var divsBtn = document.getElementById('divisionsBtn');
        document.getElementById('divisionsBtn').onclick = function () {
            var numIn = document.createElement("input");
            numIn.type = "number";
            numIn.style.width = "40px";
            numIn.defaultValue = divisions;
            var okBtn = document.createElement("input");
            okBtn.type = "button";
            okBtn.defaultValue = "Ok";
            var numInSpan = document.createElement("span");
            numInSpan.appendChild(numIn);
            numInSpan.appendChild(okBtn);
            divsBtn.parentNode.insertBefore(numInSpan, divsBtn.nextSibling);
            divsBtn.style.display = "none";
            okBtn.onclick = function () {
                cW = Math.max(divisions, cW);
                cH = Math.max(divisions, cH);
                divisions = Math.max(2, Math.min(256, numIn.value));
                doMosaic(baseImage, tileImages);
            }
        }
        // ----- allow canvas contents to be saved as local file 
        document.getElementById('saveBtn').onclick = function () {
            revealCanvas.toBlob(function (blob) {
                saveAs(blob, "mosaic.png");
            });
        };
        // ----- mosaic tiles editing tools ---------------------------
        function updateToolsSel() {
            if (mode == "deleteTiles")
                document.getElementById("tileMinusIco").style.boxShadow = "0px 0px 5px #000000";
            else
                document.getElementById("tileMinusIco").style.boxShadow = null;

            if (mode == "addTiles")
                document.getElementById("tilePlusIco").style.boxShadow = "0px 0px 5px #000000";
            else
                document.getElementById("tilePlusIco").style.boxShadow = null;

            if (mode == "view")
                document.getElementById("handIco").style.boxShadow = "0px 0px 5px #000000";
            else
                document.getElementById("handIco").style.boxShadow = null;
        }
        document.getElementById("handIco").onclick = function (e) {
            mode = "view";
            updateToolsSel();
        }
        document.getElementById("tilePlusIco").onclick = function (e) {
            if (mode == "addTiles")
                mode = "view";
            else
                mode = "addTiles";
            updateToolsSel();
        }
        document.getElementById("tileMinusIco").onclick = function (e) {
            if (mode == "deleteTiles")
                mode = "view";
            else
                mode = "deleteTiles";
            updateToolsSel();
        }
        updateToolsSel();
    }
}//endfunction

/**
*
*/
function sizeFontAndBtns(sc)
{
    document.body.style.fontSize = sc * 11 + "em";    // adjust default font size according to screen size
    var inpts = document.getElementsByTagName("input");
    for (var i = inpts.length - 1; i > -1; i--) {
        inpts[i].style.fontSize = "0.8em";       // adjust inputs font size as well
        if (inpts[i].type=="button")
        {
            inpts[i].style.padding =  50*sc+"px "+200*sc+"px";
        }
    }
}

/**
* update nav bar to reflect baseImage and tileImages
*/
function updateMosaicNav()
{
    updateBaseImageDiv(navMinimizeFlags[0]);
    updateTileImagesDiv(navMinimizeFlags[1]);
    updateSettingsDiv(navMinimizeFlags[2]);

    // ------ nav base image thumb update 
    var sc = Math.min(window.innerWidth * 0.00013, window.innerHeight * 0.00013);
    sizeFontAndBtns(sc);
}

/**
* select image of idx from tileImages and create mosaic of it using tile images
*/ 
function doMosaic(baseImg,tileImgs)
{
    baseImage = baseImg;
    tileImages = tileImgs;
    function draw() {
        generateMosaic(1);  // generate new mosaic canvas
        updateMosaicNav();
    }
    draw();
}//endfunction

/**
* returns a canvas object showing all the tiles images in cols
*/
function generateTilesCols(TileImages, TilesUsed, w, numCols, margin) 
{
    var imageKeys = Object.getOwnPropertyNames(TileImages);
    var tileW = (w - margin * (numCols - 1)) / numCols;
    var tileH = tileW / cW * cH;
    
    var tilesCanvas = document.createElement("canvas");
    tilesCanvas.width = w;
    tilesCanvas.height = Math.ceil(imageKeys.length / numCols) * (tileH + margin) - margin;
    var tilesCtx = tilesCanvas.getContext("2d");

    for (var i = imageKeys.length - 1; i > -1; i--) 
        tilesCtx.drawImage(getBestSizeFitMip(TileImages[imageKeys[i]],tileW,tileH), i % numCols * (tileW + margin), parseInt(i / numCols) * (tileH + margin), tileW, tileH);

    var px = Math.min(window.innerWidth * 0.015, window.innerHeight * 0.015);
    tilesCtx.font = "bold "+px+"px Arial";
    tilesCtx.fillStyle = "white";
    tilesCtx.textAlign = "right";
    tilesCtx.textBaseline = "bottom";
    tilesCtx.shadowColor = "black";
    tilesCtx.shadowBlur = 4;
    for (var i = imageKeys.length - 1; i > -1; i--)
        if (TilesUsed[imageKeys[i]] != null)
            tilesCtx.fillText(TilesUsed[imageKeys[i]], i % numCols * (tileW + margin) + tileW, parseInt(i / numCols) * (tileH + margin) + tileH);
    
    return tilesCanvas;
}//endfunction

/**
* returns a canvas object that is the mosaic of given base image
*/
function generateMosaic(scale) 
{
    if (scale == null) scale = 1;

    // ----- the mosaic result canvas -----------------------------------------------
    mosaicCanvas.width = scale*cW;
    mosaicCanvas.height = scale*cH;
    revealCanvas.width = mosaicCanvas.width;
    revealCanvas.height = mosaicCanvas.height;
    var mosaicCtx = mosaicCanvas.getContext("2d");

    // ----- determine tiles width height and nearest mip to use --------------------
    var iw = scale*cW / divisions;        // tile image width
    var ih = scale*cH / divisions;        // tile image height
    
    // ----- determine representative tile colors of tile images --------------------
    var imageKeys = Object.getOwnPropertyNames(tileImages);
    var imageTiles = [];                  // array of suitable sized tiles to build mosaic with
    var imageColorsData = [];             // array for the overall tint of the image for each tile
    for (var k = imageKeys.length - 1; k > -1; k--) {
        imageTiles.unshift(getBestSizeFitMip(tileImages[imageKeys[k]], iw, ih));
        imageColorsData.unshift(tileImages[imageKeys[k]]["mip1x1"].getContext("2d").getImageData(0, 0, 1, 1).data);
    }

    //
    if (imageKeys.length == 0)
    {
        mosaicCtx.drawImage(baseImage, 0, 0, baseImage.width, baseImage.height, 0, 0, mosaicCanvas.width, mosaicCanvas.height);
        return;
    }

    // ----- create base canvas to match colors with --------------------------------
    var pixelCanvas = document.createElement("canvas");
    pixelCanvas.width = divisions;
    pixelCanvas.height = divisions;
    var pixelCtx = pixelCanvas.getContext("2d");
    pixelCtx.drawImage(baseImage, 0, 0, pixelCanvas.width, pixelCanvas.height);

    TilesUsed = new Object();
    var tintVals = [];


    // ----- find suitable image for region ------------------------------------------
    var pixelCanvasColors = pixelCtx.getImageData(0,0, divisions, divisions).data;   // base image colors for every tile position
    for (var i = divisions * divisions - 1; i > -1; i--)
    {    
        var prevColorFitIdx = 0;
        var prevColorDiff = Number.MAX_VALUE;
        var bestColorFitIdx = 0;
        var bestColorDiff = Number.MAX_VALUE;
        var baseCIdx = i * 4;
        for (var k = imageKeys.length - 1; k > -1; k--) {
            var tileColors = imageColorsData[k];
            var diff =  Math.abs(tileColors[0] - pixelCanvasColors[baseCIdx])+
                        Math.abs(tileColors[1] - pixelCanvasColors[baseCIdx + 1])+
                        Math.abs(tileColors[2] - pixelCanvasColors[baseCIdx + 2])+
                        Math.abs(tileColors[3] - pixelCanvasColors[baseCIdx + 3]);
            if (bestColorDiff > diff) {
                prevColorDiff = bestColorDiff;
                prevColorFitIdx = bestColorFitIdx;
                bestColorDiff = diff;
                bestColorFitIdx = k;
            }
            else if (prevColorDiff > diff) {
                prevColorDiff = diff;
                prevColorFitIdx = k;
            }
        }

        if (Math.random() < bestColorDiff/(bestColorDiff+prevColorDiff)) bestColorFitIdx = prevColorFitIdx;    // add some randomness in large color patches
        var bestColorFitKey = imageKeys[bestColorFitIdx];

        if (TilesUsed[bestColorFitKey] == null)
            TilesUsed[bestColorFitKey] = 1;
        else
            TilesUsed[bestColorFitKey]++;

        // ----- calculate image tint to better blend at position 
        var tileColors = imageColorsData[bestColorFitIdx];
        tintVals.unshift({
            r: pixelCanvasColors[baseCIdx] - tileColors[0],
            g: pixelCanvasColors[baseCIdx + 1] - tileColors[1],
            b: pixelCanvasColors[baseCIdx + 2] - tileColors[2],
            a: pixelCanvasColors[baseCIdx + 3] - tileColors[3]
        });
        
        mosaicCtx.drawImage(imageTiles[bestColorFitIdx], i % divisions * iw, parseInt(i / divisions) * ih, iw, ih);   // draw mosaic tile 
    }
    
    // ----- tint result canvas 
    var w = mosaicCanvas.width;
    var h = mosaicCanvas.height;
    var destImgData = mosaicCtx.getImageData(0, 0, w,h);
    var destData = destImgData.data;
    for (var c = destData.length - 1; c > -1;)
    {
        var pix = c / 4;
        var x = pix % w;              // image position
        var y = Math.floor(pix / w);
        var i = Math.floor(x / iw); // tintVals position
        var j = Math.floor(y / ih);
        var tintVal = tintVals[j * divisions + i];
        destData[c] = destData[c--] + tintVal.a;
        destData[c] = destData[c--] + tintVal.b;
        destData[c] = destData[c--] + tintVal.g;
        destData[c] = destData[c--] + tintVal.r;
    }
    mosaicCtx.putImageData(destImgData, 0,0);      // rewrite destination with tinted image data
    var revealCtx = revealCanvas.getContext("2d");
    revealCtx.putImageData(destImgData, 0, 0);     // write reveal canvas with image data
}//endfunction

/**
* change canvas transform so that w,h fits screen with no overflow
*/
function adjustCanvasTransform(w,h) 
{
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var sc = Math.min(canvas.width / w, canvas.height / h) * zoom.scale;
    var offX = zoom.offX*sc;
    var offY = zoom.offY*sc;
    context.setTransform(sc, 0, 0, sc,						// sets scaling
						0.5*(canvas.width - w * sc)+offX,	// offset x so content is centered to canvas
						0.5*(canvas.height -h * sc)+offY);	// offset y so content is centered to canvas
    canvasT = {
        aa: sc, ab: 0, ba: 0, bb: sc,						// sets scaling
        ac: 0.5*(canvas.width - w * sc)+offX,			    // offset x so content is centered to canvas
        bc: 0.5*(canvas.height - h * sc)+offY				// offset x so content is centered to canvas
    };		// offset y so content is centered to canvas
    canvasInvT = {
        aa: 1 / sc, ab: 0, ac: -0.5*(canvas.width / sc - w)-offX/sc,
        ba: 0, bb: 1 / sc, bc: -0.5*(canvas.height / sc - h)-offY/sc
    };
}//endfunction

/**
* returns the current canvas scaling
*/
function getCanvasScale() 
{
    if (canvasT != null)
        return canvasT.aa;
    return 1;
}//endfunction

/**
* returns canvas position {x,y} given stage position (px,py)
*/
function canvasPosition(px, py) 
{
    return {
        x: canvasInvT.aa * px + canvasInvT.ab * py + canvasInvT.ac,
        y: canvasInvT.ba * px + canvasInvT.bb * py + canvasInvT.bc
    };
}//endfunction

/**
* given an image mip object, returns suitable sized image mip to draw to w x h
*/
function getBestSizeFitMip(imgObj,w,h)
{
    var nw = nearest2Pow(w);
    var nh = nearest2Pow(h);

    if (nw > imgObj.mw || nh > imgObj.mh)
        return imgObj.image;

    if (nw/imgObj.mw > nh/imgObj.mh)
        return imgObj["mip" + nw + "x" + Math.round(nw * imgObj.mh / imgObj.mw)];
    else
        return imgObj["mip" + Math.round(nh * imgObj.mw/imgObj.mh) + "x" + nh];
}//endfunction

/**
* creates an image object with o["image"] = original image, o["mip256x128"] = scaled image of that size etc..
*/
function createImageMipsObj(img)
{
    var imgObj = { image: img };
    
    var w = nearest2Pow(img.width);
    var h = nearest2Pow(img.height);
    imgObj.mw = w;
    imgObj.mh = h;
    while (w > 1 || h > 1) {
        for (var x = 0; Math.pow(2, x) < w; x++);
        if (x>0) w = Math.pow(2, x-1);
        for (var y = 0; Math.pow(2, y) < h; y++);
        if (y>0) h = Math.pow(2, y-1);
        var halfCanv = document.createElement("canvas");
        halfCanv.width = w;
        halfCanv.height = h;
        var ctx = halfCanv.getContext("2d");
        ctx.drawImage(img, 0, 0, halfCanv.width, halfCanv.height);
        imgObj["mip" + w + "x" + h] = halfCanv;
        img = halfCanv;
    }
    //alert("create img obj -> "+Object.getOwnPropertyNames(imgObj));
    return imgObj;
}//endfunction

/**
*
*/
function nearest2Pow(val)
{
    for (var x = 0; Math.pow(2, x) < val; x++);
    if (x>0 && Math.abs(Math.pow(2, x) - val) > Math.abs(Math.pow(2, x - 1) - val))
       x = x - 1;
    return Math.pow(2, x);
}//endfunction