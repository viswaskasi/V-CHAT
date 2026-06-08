import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: false }, // Made optional so standalone memories don't need a Chat
    userId: { type: String, required: false }, // The identifier for the user (could be a session ID or actual user ID)
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    attachment: { 
        data: { type: String }, // Base64 encoded image data
        mimeType: { type: String }
    },
    attachments: [{
        data: { type: String }, // Base64 or raw data representation
        fileName: { type: String },
        mimeType: { type: String },
        fileSize: { type: Number },
        extractedText: { type: String } // Extracted plain text for LLM/Offline model queries
    }],
    embedding: { type: [Number], required: false }, // Vector embedding for semantic search
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;
