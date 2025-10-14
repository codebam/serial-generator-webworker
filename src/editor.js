document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.addEventListener('click', analyzeSerial);
});

function analyzeSerial() {
    const serial = document.getElementById('serialInput').value.trim();
    if (!serial.startsWith('@U')) {
        alert('Invalid serial format. It must start with @U');
        return;
    }

    // Placeholder for analysis logic
    const analysisOutput = document.getElementById('analysisOutput');
    analysisOutput.innerHTML = `
        <h2>Analysis</h2>
        <p><strong>Serial:</strong> ${serial}</p>
        <p><em>Analysis functionality is not yet implemented.</em></p>
    `;
}
