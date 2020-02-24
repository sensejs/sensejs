import {Email, EmailVerificationToken, PasswordHashService, User} from '../../domains/user';
import {InjectRepository} from '@sensejs/typeorm';
import {Repository} from 'typeorm';
import {Component, Inject} from '@sensejs/core';

@Component()
export class RegistrationService {

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationTokenRepository: Repository<EmailVerificationToken>,
    @Inject(PasswordHashService)
    private passwordHashService: PasswordHashService,
  ) {}

  async registration(name: string, password: string, email?: string) {
    const user = User.create(name);
    user.changePassword(await this.passwordHashService.derivePassword(password));
    if (email) {
      user.changeEmail(new Email(email));
    }
    await this.userRepository.save(user);
  }

  async verifyEmail(token: string) {
    const tokenEntity = await this.emailVerificationTokenRepository.findOneOrFail({where: {token}});
    tokenEntity.user.verifyEmail();
    await this.userRepository.save(tokenEntity.user);
  }
}
