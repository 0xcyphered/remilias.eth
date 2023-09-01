import { ethers } from 'hardhat'
import namehash from 'eth-ens-namehash'
import { Interface } from 'ethers/lib/utils'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')
function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await deployments.get('ENSRegistry')
  const registryContract = await ethers.getContractAt(
    registry.abi,
    registry.address,
  )
  const nameWrapper = await deployments.get('RemiliasNameWrapper')
  const controller = await deployments.get('RemiliasRegistrarController')
  const registrar = await deployments.get('RemiliasRegistrar')
  const registrarContract = await ethers.getContractAt(
    registrar.abi,
    registrar.address,
  )
  const reverseRegistrar = await deployments.get('ReverseRegistrar')
  const nameWrapperContract = await ethers.getContractAt(
    nameWrapper.abi,
    nameWrapper.address,
  )

  const deployArgs = {
    from: deployer,
    args: [
      registry.address,
      nameWrapper.address,
      controller.address,
      reverseRegistrar.address,
    ],
    log: true,
  }

  const remiliasHash = namehash.hash('remilias.eth')
  const remiliasOwner = await registryContract.owner(remiliasHash)
  const resolverHash = namehash.hash('resolver.remilias.eth')

  const RemiliasResolver = await deploy('RemiliasPublicResolver', deployArgs)
  const _RemiliasResolver = await deployments.get('RemiliasPublicResolver')
  const remiliasResolver = await ethers.getContractAt(
    _RemiliasResolver.abi,
    _RemiliasResolver.address,
  )

  {
    const registrar = await deployments.get('RemiliasRegistrar')
    const artifact = await deployments.getArtifact('IRemiliasRegistrar')
    const interfaceId = computeInterfaceId(new Interface(artifact.abi))
    const implementer = await remiliasResolver.interfaceImplementer(
      remiliasHash,
      interfaceId,
    )
    if (implementer !== registrar.address) {
      const tx = await remiliasResolver.setInterface(
        remiliasHash,
        interfaceId,
        registrar.address,
      )
      console.log(
        `Setting IRemiliasRegistrar interface ID ${interfaceId} on .eth resolver (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }

  {
    const registrarController = await deployments.get(
      'RemiliasRegistrarController',
    )
    const artifact = await deployments.getArtifact(
      'RemiliasRegistrarController',
    )
    const interfaceId = computeInterfaceId(new Interface(artifact.abi))
    const implementer = await remiliasResolver.interfaceImplementer(
      remiliasHash,
      interfaceId,
    )
    if (implementer !== registrarController.address) {
      const tx = await remiliasResolver.setInterface(
        remiliasHash,
        interfaceId,
        registrarController.address,
      )
      console.log(
        `Setting RemiliasRegistrarController interface ID ${interfaceId} on remilias.eth resolver (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }

  {
    const NameWrapper = await deployments.get('RemiliasNameWrapper')
    const artifact = await deployments.getArtifact('IRemiliasNameWrapper')
    const interfaceId = computeInterfaceId(new Interface(artifact.abi))
    const implementer = await remiliasResolver.interfaceImplementer(
      remiliasHash,
      interfaceId,
    )
    if (implementer !== NameWrapper.address) {
      const tx = await remiliasResolver.setInterface(
        remiliasHash,
        interfaceId,
        NameWrapper.address,
      )
      console.log(
        `Setting IRemiliasNameWrapper interface ID ${interfaceId} on remilias.eth resolver (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }

  // if (remiliasOwner === owner && resolverOwner === ZERO_ADDRESS) {
  //   const tx = await registryContract.setSubnodeOwner(
  //     remiliasHash,
  //     '0x' + keccak256('resolver'),
  //     owner,
  //   )
  //   console.log(
  //     `Setting owner of resolver.remilias.eth node to owner on Registry (tx: ${tx.hash})...`,
  //   )
  //   await tx.wait()
  // }

  if (
    remiliasOwner === registrar.address &&
    (await registrarContract.available('0x' + keccak256('resolver')))
  ) {
    const tx = await registrarContract.registerResolver()
    console.log(
      `Setting owner of resolver.remilias.eth node to owner on Registrar (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  if (
    (await registryContract.owner(resolverHash)) === owner &&
    (await registryContract.resolver(resolverHash)) !==
      _RemiliasResolver.address
  ) {
    const tx = await registryContract.setResolver(
      resolverHash,
      _RemiliasResolver.address,
    )
    console.log(
      `Setting resolver of resolver.remilias.eth to PublicResolver (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  if (owner !== deployer) {
    const tx = await remiliasResolver.transferOwnership(owner)
    console.log(
      `Transferring ownership of PublicResolver to ${owner} (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }
}

func.id = 'resolver'
func.tags = ['resolvers', 'RemiliasPublicResolver']
func.dependencies = [
  'RemiliasRegistrar',
  'RemiliasRegistrarController',
  'RemiliasNameWrapper',
]

export default func
