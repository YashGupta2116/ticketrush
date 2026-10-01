import request from 'supertest';
import { createApp } from '@/app';

export const api = request(createApp());
