// Storage interface and implementations

import { User, Item } from '../shared/schema';

export interface IStorage {
  // User operations
  upsertUser(user: Partial<User> & { email: string }): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;

  // Item operations
  createItem(item: Omit<Item, 'id' | 'createdAt'>): Promise<Item>;
  getItemsByUserId(userId: string): Promise<Item[]>;
  getItemById(id: string, userId: string): Promise<Item | null>;
  updateItem(id: string, userId: string, updates: Partial<Item>): Promise<Item | null>;
  deleteItem(id: string, userId: string): Promise<boolean>;
}

// In-memory storage implementation (for development)
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private items: Map<string, Item> = new Map();
  private userByEmail: Map<string, string> = new Map(); // email -> userId

  async upsertUser(userData: Partial<User> & { email: string }): Promise<User> {
    const existing = this.userByEmail.get(userData.email);
    
    if (existing) {
      const user = this.users.get(existing)!;
      const updated = {
        ...user,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(existing, updated);
      return updated;
    }

    const newUser: User = {
      id: userData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: userData.email,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(newUser.id, newUser);
    this.userByEmail.set(newUser.email, newUser.id);
    return newUser;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.userByEmail.get(email);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async createItem(itemData: Omit<Item, 'id' | 'createdAt'>): Promise<Item> {
    const newItem: Item = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    this.items.set(newItem.id, newItem);
    return newItem;
  }

  async getItemsByUserId(userId: string): Promise<Item[]> {
    return Array.from(this.items.values())
      .filter(item => item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getItemById(id: string, userId: string): Promise<Item | null> {
    const item = this.items.get(id);
    if (!item || item.userId !== userId) {
      return null;
    }
    return item;
  }

  async updateItem(id: string, userId: string, updates: Partial<Item>): Promise<Item | null> {
    const item = this.items.get(id);
    if (!item || item.userId !== userId) {
      return null;
    }
    
    const updated: Item = {
      ...item,
      ...updates,
      // Don't allow changing id, userId, or createdAt
      id: item.id,
      userId: item.userId,
      createdAt: item.createdAt,
    };
    
    this.items.set(id, updated);
    return updated;
  }

  async deleteItem(id: string, userId: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || item.userId !== userId) {
      return false;
    }
    this.items.delete(id);
    return true;
  }
}

// Singleton instance
export const storage = new MemStorage();

