import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TFile } from 'obsidian';

interface SummarizerSettings {
	GPTAPIKey: string;
}

const DEFAULT_SETTINGS: SummarizerSettings = {
	GPTAPIKey: ''
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
							console.log("sending request to GPT")
							console.log(summary);
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
		const oneWeekAgo = currentTime - 7 * 24 * 60 * 60 * 1000;
		const files = this.app.vault.getFiles();

		let content = '';

		for (const file of files) {
			if (file instanceof TFile) {
				const fileCtime = new Date(file.stat.ctime);

				if (fileCtime.getTime() > oneWeekAgo) {
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
			model: 'gpt-4-0314',
			messages: [
				{
					role: 'user',
					content: `Summarize this content into a list of bullets organized by subject ordered by perceived importance. At the bottom of the output, provide flashcards for important facts: ${content}`,
				},
			],
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
	}
}
