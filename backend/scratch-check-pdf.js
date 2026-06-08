import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const messageSchema = new mongoose.Schema({
    role: { type: String },
    content: { type: String },
    attachments: [{
        data: { type: String },
        fileName: { type: String },
        mimeType: { type: String },
        fileSize: { type: Number },
        extractedText: { type: String }
    }]
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

async function run() {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chatbot';
    try {
        await mongoose.connect(dbUri);
        console.log("Connected to DB");
        
        const msg = await Message.findOne({ role: 'user', attachments: { $exists: true, $not: { $size: 0 } } })
            .sort({ createdAt: -1 })
            .lean();
            
        if (!msg) {
            console.log("No messages with attachments found.");
            return;
        }
        
        console.log("Found message with attachments:");
        console.log("ID:", msg._id);
        console.log("Content:", msg.content);
        console.log("Created At:", msg.createdAt);
        console.log("Attachments count:", msg.attachments.length);
        
        msg.attachments.forEach((att, idx) => {
            console.log(`Attachment ${idx + 1}:`);
            console.log("  File Name:", att.fileName);
            console.log("  MIME Type:", att.mimeType);
            console.log("  File Size:", att.fileSize);
            console.log("  Extracted Text Length:", att.extractedText ? att.extractedText.length : 0);
            console.log("  Extracted Text Preview:", att.extractedText ? att.extractedText.substring(0, 500) : "none");
        });
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
