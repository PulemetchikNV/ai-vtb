const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const transcriptionText = document.getElementById('transcription-text');
const errorContainer = document.getElementById('error-container');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorContainer.textContent = '';
    transcriptionText.textContent = 'Processing...';

    const file = fileInput.files[0];
    if (!file) {
        transcriptionText.textContent = '';
        errorContainer.textContent = 'Please select a file to upload.';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/transcribe/', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'An unknown error occurred.');
        }

        const result = await response.json();
        transcriptionText.textContent = result.transcription;
    } catch (error) {
        transcriptionText.textContent = '';
        errorContainer.textContent = `Error: ${error.message}`;
    }
});
