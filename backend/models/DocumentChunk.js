import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema({
    chat: { type: String, required: true }, // Store as string to support both mongoose ObjectIds and localDB fallback string IDs
    fileName: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: false }
}, { timestamps: true });

// Check if model already exists to prevent OverwriteModelError during hot reloads
const DocumentChunk = mongoose.models.DocumentChunk || mongoose.model('DocumentChunk', documentChunkSchema);
export default DocumentChunk;
