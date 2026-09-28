// I/O helpers: toast notifications, clipboard, file downloads.

var __toastTimer = null;
function showToast(message, kind) {
	var el = document.getElementById('toast');
	if (!el) return;
	el.textContent = message;
	el.className = 'toast show' + (kind ? ' toast-' + kind : '');
	if (__toastTimer) clearTimeout(__toastTimer);
	__toastTimer = setTimeout(function () {
		el.className = 'toast' + (kind ? ' toast-' + kind : '');
	}, 2200);
}

function copyToClipboard(text) {
	function fallback() {
		try {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			ta.style.top = '0';
			document.body.appendChild(ta);
			ta.select();
			ta.setSelectionRange(0, text.length);
			var ok = document.execCommand('copy');
			document.body.removeChild(ta);
			return ok;
		} catch (e) {
			return false;
		}
	}
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text).then(
			function () { return true; },
			function () { return fallback(); }
		);
	}
	return Promise.resolve(fallback());
}

function copyPNGCanvasToClipboard(sourceCanvas) {
	if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined' || !sourceCanvas || !sourceCanvas.toBlob) {
		return Promise.resolve(false);
	}
	try {
		var imageBlob = new Promise(function (resolve) {
			sourceCanvas.toBlob(function (blob) { resolve(blob); }, 'image/png');
		});
		return navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]).then(
			function () { return true; }, function () { return false; }
		);
	} catch (e) { return Promise.resolve(false); }
}

function downloadBlob(filename, content, mime) {
	try {
		var blob = new Blob([content], { type: mime || 'application/octet-stream' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
		return true;
	} catch (e) {
		return false;
	}
}

function downloadDataURL(filename, dataURL) {
	try {
		var a = document.createElement('a');
		a.href = dataURL;
		a.download = filename;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		return true;
	} catch (e) {
		return false;
	}
}

function safeFileName(name, ext) {
	var base = (name || 'fsm').replace(/[^A-Za-z0-9._\-؀-ۿݐ-ݿ]+/g, '_');
	if (!base) base = 'fsm';
	return base + '.' + ext;
}

function activeFSMFileName(ext) {
	var name = 'fsm';
	try {
		if (typeof Workspace !== 'undefined') {
			var active = Workspace.getActive();
			if (active && active.name) name = active.name;
		}
	} catch (e) {}
	return safeFileName(name, ext);
}
