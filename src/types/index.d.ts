import type * as React from 'react';

export interface Message {
	role: 'user' | 'assistant';
	content: string;
	id: string;
}

export interface ChatRequest {
	messages: Message[];
	vectorStoreId?: string | null;
	previousResponseId?: string | null;
}

export interface ChatResponse {
	response: string;
	error?: string;
}

// From src/hooks/use-file-upload.ts
export type FileMetadata = {
	name: string;
	size: number;
	type: string;
	url: string;
	id: string;
};

export type FileWithPreview = {
	file: File | FileMetadata;
	id: string;
	preview?: string;
};

export type FileUploadOptions = {
	maxFiles?: number;
	maxSize?: number;
	accept?: string;
	multiple?: boolean;
	initialFiles?: FileMetadata[];
	onFilesChange?: (files: FileWithPreview[]) => void;
	onFilesAdded?: (addedFiles: FileWithPreview[]) => void;
};

export type FileUploadState = {
	files: FileWithPreview[];
	isDragging: boolean;
	errors: string[];
};

export type FileUploadActions = {
	addFiles: (files: FileList | File[]) => void;
	removeFile: (id: string) => void;
	clearFiles: () => void;
	clearErrors: () => void;
	handleDragEnter: (e: React.DragEvent<HTMLElement>) => void;
	handleDragLeave: (e: React.DragEvent<HTMLElement>) => void;
	handleDragOver: (e: React.DragEvent<HTMLElement>) => void;
	handleDrop: (e: React.DragEvent<HTMLElement>) => void;
	handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	openFileDialog: () => void;
	getInputProps: (
		props?: React.InputHTMLAttributes<HTMLInputElement>,
	) => React.InputHTMLAttributes<HTMLInputElement> & {
		ref: React.Ref<HTMLInputElement>;
	};
};

// From src/components/ui/upload-files.tsx
export type UploadStatus = {
	fileId: string;
	completed: boolean;
	status: 'queued' | 'uploading_to_server' | 'pending_openai' | 'completed_openai' | 'failed';
	error?: string;
};

// Originally from src/components/ui/upload-files.tsx, also used in page.tsx and config-panel.tsx
export type OpenAIProcessedFile = {
	name: string;
	fileId: string;
	vectorStoreId: string;
};

// From src/app/page.tsx and src/components/ui/chat-input.tsx
export interface StoreDetail {
	id: string;
	name: string;
	isActive: boolean;
}

// From src/components/ui/chat-input.tsx
export interface ChatInputProps {
	onSend: (message: string) => void;
	onOpenSettings: () => void;
	disabled: boolean;
	availableStores?: StoreDetail[];
	onStoreToggle?: (storeId: string) => void;
}

// From src/components/ui/chat-message.tsx
export interface ChatMessageProps {
	message: Message;
}

// From src/components/ui/config-panel.tsx
export interface ConfigPanelProps {
	selectedVectorStoreId: string | null;
	onSelectedVectorStoreChange: (storeId: string | null) => void;
}
