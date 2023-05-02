import { Plugin } from 'obsidian';
import { TFile } from 'obsidian';

export default class SummarizerPlugin extends Plugin {
	onload() {
		this.addCommand({
			id: 'get-modified-files-content',
			name: 'Get Modified Files Content',
			checkCallback: (checking: boolean) => {
				if (!checking) {
					this.getModifiedFilesContent().then((content) => {
						console.log(content);
					});
				}
				return true;
			},
		});
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
}
