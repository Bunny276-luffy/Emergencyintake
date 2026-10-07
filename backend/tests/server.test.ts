import request from 'supertest';
import { app } from '../src/server/app';

describe('Server Initialization', () => {
  it('should initialize Express app successfully', async () => {
    expect(app).toBeDefined();
  });
});
