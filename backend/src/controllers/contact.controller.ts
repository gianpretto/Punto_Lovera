import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { contactSchema } from '../schemas/contact.schema';
import * as contactService from '../services/contact.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = contactSchema.parse(req.body);
  await contactService.createContactMessage(input);
  res.status(201).json({ message: 'Recibimos tu consulta. Te vamos a responder a la brevedad.' });
});
