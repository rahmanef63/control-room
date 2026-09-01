import { readLocal, writeLocal } from '$lib/local-storage';
import {
	TEMPLATES_STORAGE_KEY,
	createTemplateEntry,
	duplicateTemplateEntry,
	normalizeTemplates,
	updateTemplateEntry,
	type TemplateCreateInput,
	type TemplateUpdateInput,
	type TerminalTemplate
} from './templates';

class TemplatesState {
	templates = $state<TerminalTemplate[]>([]);
	hydrated = $state(false);

	init(): void {
		if (this.hydrated || typeof window === 'undefined') return;
		this.templates = normalizeTemplates(readLocal<unknown>(TEMPLATES_STORAGE_KEY, []));
		this.hydrated = true;
	}

	create(input: TemplateCreateInput): TerminalTemplate {
		const created = createTemplateEntry(this.templates, input);
		this.#publish([...this.templates, created]);
		return created;
	}

	update(id: string, input: TemplateUpdateInput): TerminalTemplate | null {
		const result = updateTemplateEntry(this.templates, id, input);
		if (result.updated) this.#publish(result.templates);
		return result.updated;
	}

	delete(id: string): void {
		const next = this.templates.filter((template) => template.id !== id);
		if (next.length !== this.templates.length) this.#publish(next);
	}

	duplicate(id: string): TerminalTemplate | null {
		const result = duplicateTemplateEntry(this.templates, id);
		if (result.duplicate) this.#publish(result.templates);
		return result.duplicate;
	}

	#publish(next: TerminalTemplate[]): void {
		this.templates = next;
		writeLocal(TEMPLATES_STORAGE_KEY, next);
	}
}

export const templatesState = new TemplatesState();
