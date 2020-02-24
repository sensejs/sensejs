import {Body, Controller, POST} from '@sensejs/http';
import {RegistrationService} from '../../application/registration/registration';
import {Inject} from '@sensejs/core';

@Controller('/registration')
export class RegistrationController {

  constructor(@Inject(RegistrationService) private registrationService: RegistrationService) {

  }

  @POST('/registration')
  async registration(@Body() body: {name: string; password: string; email?: string}) {
    await this.registrationService.registration(body.name, body.password, body.email);
  }

  @POST('/verify-email')
  async verifyEmail(@Body() body: {token: string}) {
    await this.registrationService.verifyEmail(body.token);
  }

}
