// @ts-ignore

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  const vscode = acquireVsCodeApi();

  let response = "";

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    if (!event.origin.startsWith("vscode-webview:")) {
      return;
    }
    const message = event.data;
    switch (message.type) {
      case "addResponse": {
        response = message.value;
        setResponse();
        break;
      }
      case "clearResponse": {
        response = "";
        break;
      }
      case "setPrompt": {
        document.getElementById("prompt-input").value = message.value;
        break;
      }
      case "setTokenCount": {
        document.getElementById("token-count").innerText = message.value;
        break;
      }
    }
  });

  function fixCodeBlocks(response) {
    // Use a regular expression to find all occurrences of the substring in the string
    const REGEX_CODEBLOCK = /```/g;
    const matches = response.match(REGEX_CODEBLOCK);

    // Return the number of occurrences of the substring in the response, check if even
    const count = matches ? matches.length : 0;
    if (count % 2 === 0) {
      return response;
    } else {
      // append ``` to the end to make the last code block complete
      return response.concat("\n```");
    }
  }

  function setResponse() {
    let converter = new showdown.Converter({
      omitExtraWLInCodeBlocks: true,
      simplifiedAutoLink: true,
      excludeTrailingPunctuationFromURLs: true,
      literalMidWordUnderscores: true,
      simpleLineBreaks: true,
    });
    response = fixCodeBlocks(response);
    let html = converter.makeHtml(response);
    document.getElementById("response").innerHTML = html;

    let preCodeBlocks = document.querySelectorAll("pre code");
    for (const preCodeBlock of preCodeBlocks) {
      preCodeBlock.classList.add("p-2", "my-2", "block", "overflow-x-scroll");
    }

    let codeBlocks = document.querySelectorAll("code");
    for (const element of codeBlocks) {
      // Check if innertext starts with "Copy code"
      if (element.innerText.startsWith("Copy code")) {
        element.innerText = element.innerText.replace("Copy code", "");
      }

      element.classList.add("inline-flex", "max-w-full", "overflow-hidden", "rounded-sm", "cursor-pointer");

      element.addEventListener("click", function (e) {
        e.preventDefault();
        vscode.postMessage({
          type: "codeSelected",
          value: this.innerText,
        });
      });

      const d = document.createElement("div");
      d.innerHTML = element.innerHTML;
      element.innerHTML = null;
      element.appendChild(d);
      d.classList.add("code");
    }

    microlight.reset("code");
  }

  // Listen for keyup events on the prompt input element
  document.getElementById("prompt-input").addEventListener("keyup", function (e) {
    // If the key that was pressed was the Enter key
    if (e.key === "Enter") {
      vscode.postMessage({
        type: "prompt",
        value: this.value,
      });
    }
  });
})();
