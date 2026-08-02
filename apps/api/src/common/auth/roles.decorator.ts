import { SetMetadata } from '@nestjs/common';
import type { PapelAdmin } from '@prisma/client';

export const ROLES_KEY = 'papeis';

/** Restringe a rota aos papeis de admin informados (usado com RolesGuard). */
export const Roles = (...papeis: PapelAdmin[]) => SetMetadata(ROLES_KEY, papeis);
