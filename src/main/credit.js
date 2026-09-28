// Makes sure the footer credit reads "... Moeein Aali and Gary Young in 2026".
// A no-op when the page source already says so.
function addCreditLine() {
  var footer = document.querySelector("footer");
  if (!footer || footer.textContent.indexOf("Gary Young") >= 0) return;
  footer.appendChild(document.createTextNode(" and "));
  var a = document.createElement("a");
  a.href = "https://github.com/bluelightspirit";
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Gary Young";
  footer.appendChild(a);
  footer.appendChild(document.createTextNode(" in 2026"));
}
