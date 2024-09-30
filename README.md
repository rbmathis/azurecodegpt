# azurecodegpt-auth: GPT3 and ChatGPT extension for VSCode

<p align="center">
This project is a large rewrite of  <a href="https://github.com/ThePush/azurecodegpt">AzureCodeGPT</a> that uses Azure OpenAI hosted in Azure commercial or GovCloud *without* requiring an API key. The extension provides an AI coding assistant to developers in Gov/DoD that cannot use GitHub Copilot due to security copmliance restraints. The configuration for this version requires you to set the Azure Graph endpoint Uri for authorization in commercial/govcloud/IL5, and a Uri to an Azure KeyVault in commercial or AzureGov that contains the necessary secrets:

- `AOAIDeployment`: the name of the AOAI deployment. Ex. "gpt-35-turbo" or "gpt-4o"	
- `AOAIEndpoint`: the Uri of AOAI instance. Ex. https://yourname.openai.azure.us/ or https://yourname.openai.azure.com/
- `AOAIKey` : the API Key from the AOAI instance
</p>

### Imperatives:
You must ensure that you are using the correct cloud for IL-classified work. The extension will not do this for you.  It will simply use the secrets that have been set inside KeyVault, so make sure that 

This Visual Studio Code extension allows you to use the [official Azure OpenAI Client Library](https://learn.microsoft.com/en-us/javascript/api/overview/azure/openai-readme?view=azure-node-preview) to generate code or natural language responses to your questions from any GPT model hosted by Azure OpenAI.

Supercharge your coding with AI-powered assistance! Automatically write new code from scratch, ask questions, get explanations, refactor code, find bugs and more 🚀✨ 


### Links:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=bartonmathis.aoaigpt)**
- **[Github Repository](https://github.com/rbmathis/aoaigpt)**

<br>

# 📢 v2.0 Release

-   Based on the original <a href="https://marketplace.visualstudio.com/items?itemName=jeremysemel.azurecodegpt">CodeGPT</a> v1.1.2
-   Updated to latest version of openai, added functionality to create unit tests

&nbsp;

# 🌟 Preview
<img src="examples/main.png" alt="Refactoring selected code using chatGPT"/>

## Features
- 💡 **Ask general questions** or use code snippets from the editor to query GPT3 via an input box in the sidebar
- 🖱️ Right click on a code selection and run one of the context menu **shortcuts**
	- automatically write documentation for your code
	- explain the selected code
	- refactor or optimize it
	- find problems with it
- 💻 View GPT's responses in a panel next to the editor
- 📝 **Insert code snippets** from the AI's response into the active editor by clicking on them



## Installation

To use this extension, install it from the VSCode marketplace.

1. After the installation is complete, you will need to add your Azure Graph Uri endpoint and KeyVault Uri to the extension settings in VSCode. To do this, open the `Settings` panel by going to the `File` menu and selecting `Preferences`, then `Settings`.
2. In the search bar, type `aoaigpt` to filter the settings list.
3. In the aoaigpt section, enter your values.

After completing these steps, the extension should be ready to use after a restart.

<img src="examples/userSettings.png" alt="User Settings"/>

## Using the Extension

To use the extension, open a text editor in Visual Studio Code and open the aoaigpt panel by clicking on the aoaigpt icon in the sidebar. This will open a panel with an input field where you can enter your prompt or question. By clicking enter, it will be sent to AOAI. Its response will be displayed below the input field in the sidebar (note that it may take some time for it to be calculated).

<img src="examples/create.png" alt="Writing new code using chatGPT" width="500"/>

You can also select a code snippet in the editor and then enter a prompt in the side panel, or right-click and select "Ask aoaigpt". The **selected code will be automatically appended** to your query when it is sent to the AI. This can be useful for generating code snippets or getting explanations for specific pieces of code.

<img src="examples/explain.png" alt="Refactoring selected code using chatGPT"/>

To **insert a code snippet** from the AI's response into the editor, simply click on the code block in the panel. The code will be automatically inserted at the cursor position in the active editor.

<img src="examples/refactor.png" alt="chatGPT explaining selected code"/>

You can select some code in the editor, right click on it and choose one of the following **shortcuts** from the context menu:
#### Commands:
- `Ask aoaigpt`: will provide a prompt for you to enter any query
- `aoaigpt: Explain selection`: will explain what the selected code does
- `aoaigpt: Refactor selection`: will try to refactor the selected code
- `aoaigpt: Find problems`: looks for problems/errors in the selected code, fixes and explains them
- `aoaigpt: Optimize selection`: tries to optimize the selected code

`Ask aoaigpt` is also available when nothing is selected. For the other four commands, you can **customize the exact prompt** that will be sent to the AI by editing the extension settings in VSCode Preferences.

