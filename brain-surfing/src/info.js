(function () {
    const nav = document.getElementById("info-page-nav");
    const content = document.getElementById("info-page-content");
    const topBackLink = document.getElementById("info-page-back-link");
    const infoContent = window.BrainSurfingInfoContent;

    if (!nav || !content || !infoContent) return;

    const validDatasets = ["sleep", "seizure", "user"];
    const params = new URLSearchParams(window.location.search);
    const requestedDataset = params.get("dataset");
    const datasetKey = validDatasets.includes(requestedDataset) ? requestedDataset : "sleep";
    const backHref = `index.html?dataset=${encodeURIComponent(datasetKey)}`;

    if (topBackLink) {
        topBackLink.href = backHref;
    }

    nav.innerHTML = validDatasets.map((key) => {
        const info = infoContent.getDatasetInfo(key);
        const label = key === "user" ? "Upload" : key.charAt(0).toUpperCase() + key.slice(1);
        const activeClass = key === datasetKey ? " active" : "";
        return `<a class="info-page-tab${activeClass}" href="info.html?dataset=${encodeURIComponent(key)}">${label}<span>${info.badge}</span></a>`;
    }).join("");

    content.innerHTML = `
      ${infoContent.renderDatasetSection(datasetKey, "EDF Info")}
      ${infoContent.renderHowToSurfSection()}
      <div class="info-page-actions">
        <a class="info-page-back" href="${backHref}">Back to the wave</a>
      </div>
    `;
})();
