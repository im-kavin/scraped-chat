import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatRequest } from '../../../types'; // Adjusted path

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const VECTOR_STORE_NAME = 'scraped_chat_files_store';

export async function PUT(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
		}

		let vectorStoreIdToUse: string;
		const stores = await openai.vectorStores.list();
		const existingStore = stores.data.find((vs) => vs.name === VECTOR_STORE_NAME);

		if (existingStore) {
			vectorStoreIdToUse = existingStore.id;
		} else {
			const newStore = await openai.vectorStores.create({ name: VECTOR_STORE_NAME });
			vectorStoreIdToUse = newStore.id;
		}

		const openaiFile = await openai.files.create({
			file: file,
			purpose: 'assistants', // Purpose for files used with Assistants/File Search
		});

		// Add file to the vector store
		await openai.vectorStores.files.create(vectorStoreIdToUse, {
			// biome-ignore lint/style/useNamingConvention: required for OpenAI API
			file_id: openaiFile.id,
		});

		return NextResponse.json({
			success: true,
			fileName: file.name,
			fileId: openaiFile.id, // This is the OpenAI File ID
			vectorStoreId: vectorStoreIdToUse, // This is the Vector Store ID
			message: `File "${file.name}" uploaded and added to vector store "${VECTOR_STORE_NAME}".`,
		});
	} catch (error: unknown) {
		let errorMessage = 'An error occurred while processing your file with OpenAI.';
		let statusCode = 500;

		if (error instanceof OpenAI.APIError) {
			errorMessage = error.message || errorMessage;
			statusCode = error.status || statusCode;
		} else if (error instanceof Error) {
			errorMessage = error.message;
		}

		return NextResponse.json({ error: errorMessage }, { status: statusCode });
	}
}

//biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export async function POST(request: Request) {
	// 'messages' from your existing setup needs to be adapted to the 'input' structure of Responses API
	const { messages, vectorStoreId, previousResponseId }: ChatRequest = await request.json();

	try {
		let currentInputItems: OpenAI.Responses.ResponseInput;
		if (messages && messages.length > 0) {
			const lastUserMessage = messages[messages.length - 1];
			if (lastUserMessage.role === 'user') {
				currentInputItems = [
					{ type: 'message', role: lastUserMessage.role, content: lastUserMessage.content },
				];
			} else {
				// Fallback if the last message is not from the user, or an unexpected structure.
				// Assuming the API expects a user message here.
				currentInputItems = [{ type: 'message', role: 'user', content: 'Proceed.' }];
			}
		} else {
			return NextResponse.json({ error: 'No input message provided.' }, { status: 400 });
		}

		// Using OpenAI.Responses.CreateParams as per corrected understanding
		const createParams: OpenAI.Responses.ResponseCreateParams = {
			model: 'gpt-4.1-nano', 
			input: currentInputItems,
			instructions:
				"You are a friendly and helpful assistant. If relevant, use the information from the provided files to answer the user's query.", // Default system prompt
			temperature: 0.7, // Default temperature
		};

		if (previousResponseId) {
			createParams.previous_response_id = previousResponseId;
		}

		if (vectorStoreId) {
			// For the Responses API, you specify built-in tools and link them to resources (like vector stores)
			// The 'tools' array takes tool definitions. For file_search, it involves specifying the vector_store_id.
			createParams.tools = [
				{
					type: 'file_search',
					// This key might be implicit if type is "file_search"
					// biome-ignore lint/style/useNamingConvention: OpenAI API requirement
					vector_store_ids: [vectorStoreId],
				},
			];
			// Optional: Guide the model to use the tool
			// createParams.tool_choice = { type: "file_search" }; // Can be "auto" or specific
		}

		const response = await openai.responses.create(createParams);

		// The Response object has a different structure.
		// The main text output is often in response.output_text (SDK convenience)
		// or you might need to parse response.output for message items.
		let responseContent = '';
		if (response.output_text) {
			responseContent = response.output_text;
		} else if (response.output && response.output.length > 0) {
			// Look for message outputs
			const messageOutput = response.output.find(
				(item) => item.type === 'message' && item.role === 'assistant',
			);
			if (messageOutput && messageOutput.type === 'message' && messageOutput.content) {
				const textContent = messageOutput.content.find((part) => part.type === 'output_text');
				if (textContent && textContent.type === 'output_text') {
					responseContent = textContent.text;
				}
			}
		}

		if (!responseContent && response.status === 'failed' && response.error) {
			responseContent = `Error from Responses API: ${response.error.message}`;
		} else if (!responseContent && response.status !== 'completed') {
			responseContent = `Response status: ${response.status}. No text content extracted.`;
		} else if (!responseContent) {
			responseContent = 'Received a response, but could not extract text content.';
		}

		// You'll also want to return the new response.id to the client
		// so it can be used as 'previous_response_id' for the next turn.
		return NextResponse.json({
			response: responseContent,
			responseId: response.id, // Send back the response ID for conversation continuity
		});
	} catch (error) {
		let errorMessage = 'An error occurred while processing your request with the Responses API.';
		let statusCode = 500;
		if (error instanceof OpenAI.APIError) {
			errorMessage = error.message || errorMessage;
			statusCode = error.status || statusCode;
		}
		return NextResponse.json({ error: errorMessage }, { status: statusCode });
	}
}

//biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export async function DELETE(request: Request) {
	const { fileId, vectorStoreId } = await request.json();

	if (!(fileId && vectorStoreId)) {
		return NextResponse.json({ error: 'Missing fileId or vectorStoreId.' }, { status: 400 });
	}

	try {
		// 1. Delete the file from the vector store
		try {
			await openai.vectorStores.files.del(vectorStoreId, fileId);
		} catch (error: unknown) {
			if (error instanceof OpenAI.APIError && error.status === 404) {
				// File not found in vector store, which is acceptable.
				// We can proceed to attempt deletion from OpenAI storage.
			} else {
				throw error;
			}
		}

		// 2. Delete the file itself from OpenAI
		try {
			await openai.files.del(fileId);
		} catch (error: unknown) {
			if (error instanceof OpenAI.APIError && error.status === 404) {
				// File not found in OpenAI storage, which is acceptable.
				// It might have been already deleted or never existed.
			} else {
				throw error;
			}
		}

		return NextResponse.json({
			success: true,
			message: `File ${fileId} successfully processed for deletion from vector store and OpenAI storage.`,
		});
	} catch (error: unknown) {
		let errorMessage = `Failed to delete file ${fileId}.`;
		let statusCode = 500;

		if (error instanceof OpenAI.APIError) {
			errorMessage = error.message
				? `${errorMessage} OpenAI Error: ${error.message}`
				: errorMessage;
			statusCode = error.status || statusCode;
		} else if (error instanceof Error) {
			errorMessage = `${errorMessage} Error: ${error.message}`;
		} else {
			errorMessage = `${errorMessage} Unknown error.`;
		}
		return NextResponse.json({ error: errorMessage, fileId: fileId }, { status: statusCode });
	}
}
