import { Plugin, PluginSettingTab, Setting, MarkdownView, Notice } from 'obsidian';
import { TFile } from 'obsidian';

interface SummarizerSettings {
	GPTAPIKey: string;
	numRecentDays: number;
}

const DEFAULT_SETTINGS: SummarizerSettings = {
	GPTAPIKey: '',
	numRecentDays: 7
}

export default class SummarizerPlugin extends Plugin {
	settings: SummarizerSettings;


	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: 'get-modified-files-content',
			name: 'Get Modified Files Content',
			checkCallback: (checking: boolean) => {
				if (!checking) {
					this.getModifiedFilesContent().then((content) => {
						generateSummary(this.settings.GPTAPIKey, content).then((summary) => {
							console.log("sending request to GPT");
							console.log(summary);

							// Copy the summary to the clipboard
							navigator.clipboard.writeText(summary).then(() => {
								// Notification when the response from GPT-4 is ready
								new Notice('Summary copied to clipboard');
							}).catch(err => {
								console.error('Could not copy text: ', err);
							});
						});
					});
				}
				return true;
			},
		});
		this.addSettingTab(new SummarizerSettingTab(this.app, this));
	}

	async getModifiedFilesContent(): Promise<string> {
		const currentTime = new Date().getTime();
		const numRecentDays = this.settings.numRecentDays;
		const recentTime = currentTime - numRecentDays * 24 * 60 * 60 * 1000;
		const files = this.app.vault.getFiles();

		let content = '';

		for (const file of files) {
			if (file instanceof TFile) {
				const fileCtime = new Date(file.stat.ctime);

				if (fileCtime.getTime() > recentTime) {
					const fileContent = await this.app.vault.read(file);
					content += fileContent + '\n';
				}
			}
		}

		return content;
	}



	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}

async function generateSummary(apiKey: string, content: string): Promise<string> {
	return new Promise(async (resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const url = 'https://api.openai.com/v1/chat/completions';

		xhr.open('POST', url, true);
		xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);

		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					const response = JSON.parse(xhr.responseText);
					resolve(response.choices[0].message.content);
				} else {
					reject(new Error('Request failed'));
				}
			}
		};

		const payload = {
			model: 'gpt-4',
			messages: [
				{
					role: 'user',
					content: `Summarize this content. Use Markdown format. Add flascards and footnotes at the bottom.: ${content}`,
				},
			],
			max_tokens: 4000,
		};

		xhr.send(JSON.stringify(payload));
	});
}


class SummarizerSettingTab extends PluginSettingTab {
	plugin: SummarizerPlugin;

	constructor(app: App, plugin: SummarizerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Notes Summarizer Settings' });

		new Setting(containerEl)
			.setName('GPT-4 API Key')
			.setDesc('https://platform.openai.com/account/api-keys')
			.addText(text => text
				.setPlaceholder('API Key')
				.setValue(this.plugin.settings.GPTAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.GPTAPIKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Number of Recent Days')
			.setDesc('Number of recent days to include in the summary')
			.addText(text => text
				.setPlaceholder('Number of Recent Days')
				.setValue(String(this.plugin.settings.numRecentDays)) // Convert the number to a string for the text field
				.onChange(async (value) => {
					this.plugin.settings.numRecentDays = Number(value); // Convert the input string back to a number
					await this.plugin.saveSettings();
				}));
	}
}
